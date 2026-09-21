import { Inject, Injectable } from '@nestjs/common';
import type { DerivedContentProjection, ManuscriptBlock, ManuscriptProjectionV1, ManuscriptSnapshot, ManuscriptWarning } from '../../../../shared/manuscript.interface';
import { PaperProjectRepository } from '../paper-project.repository';
import { assembleOutlineTree } from './manuscript-tree-assembler';
import { computeBodyFingerprint, countManuscriptWordsV1, sha256Canonical } from './manuscript-fingerprint';
import { WholeDocumentCitationNormalizer } from '../../grounded-generation/citation/whole-document-citation-normalizer';
import type { BibliographyEntry, CitationPlacementV1, CitationReference, EvidenceTrace } from '../../grounded-generation/grounded-generation.types';

const missingDerived = (role: 'ABSTRACT' | 'KEYWORDS'): DerivedContentProjection => ({ role, state: 'MISSING' });

@Injectable()
export class ManuscriptProjectionService {
  private readonly citationNormalizer = new WholeDocumentCitationNormalizer();
  constructor(
    @Inject(PaperProjectRepository)
    private readonly repository: Pick<PaperProjectRepository, 'loadManuscriptSnapshot'>,
  ) {}

  async getProjection(userId: string, projectId: string): Promise<ManuscriptProjectionV1> {
    return this.project(await this.repository.loadManuscriptSnapshot(userId, projectId));
  }

  project(snapshot: ManuscriptSnapshot): ManuscriptProjectionV1 {
    const ordered = assembleOutlineTree(snapshot.outline);
    const sectionByNode = new Map(snapshot.sections
      .filter((section) => section.sectionRole === 'OUTLINE' && section.status === 'active' && section.outlineNodeId)
      .map((section) => [section.outlineNodeId!, section]));
    const blocks: ManuscriptBlock[] = [];
    const warnings: ManuscriptWarning[] = [];
    const support = { validSections: 0, staleSections: 0, notClaimedSections: 0, missingSections: 0 };

    if (!snapshot.project.selectedTitle?.trim()) warnings.push({ code: 'TITLE_MISSING', severity: 'warning', message: 'The manuscript title is missing.' });
    if (!snapshot.project.researchPlan) warnings.push({ code: 'RESEARCH_PLAN_MISSING', severity: 'warning', message: 'The Research Plan is missing.' });

    for (const { node, depth } of ordered) {
      const section = node.nodeType === 'writing-unit' ? sectionByNode.get(node.id) : undefined;
      blocks.push({ kind: 'heading', nodeId: node.id, ...(section ? { sectionId: section.id } : {}), level: depth + 1, title: node.title });
      if (node.nodeType !== 'writing-unit') continue;
      const revision = section ? snapshot.revisionsBySectionId[section.id] : undefined;
      if (!section || !revision) {
        blocks.push({ kind: 'missing-section', nodeId: node.id, ...(section ? { sectionId: section.id } : {}), text: '【本节尚未完成】' });
        warnings.push({ code: 'MISSING_SECTION', severity: 'warning', message: 'An outline section has no current content.', nodeId: node.id, ...(section ? { sectionId: section.id } : {}) });
        support.missingSections += 1;
        continue;
      }
      blocks.push({ kind: 'paragraph', sectionId: section.id, revisionId: revision.id, text: revision.content });
      if (revision.supportState === 'VALID') support.validSections += 1;
      else if (revision.supportState === 'STALE_AFTER_EDIT') {
        support.staleSections += 1;
        warnings.push({ code: 'STALE_AFTER_EDIT', severity: 'warning', message: 'A section was edited after evidence-backed generation.', nodeId: node.id, sectionId: section.id, revisionId: revision.id });
      } else support.notClaimedSections += 1;
    }

    for (const section of snapshot.sections.filter((item) => item.sectionRole === 'OUTLINE' && item.status === 'orphaned' && item.currentRevisionNumber > 0)) {
      warnings.push({ code: 'ORPHANED_SECTION_EXCLUDED', severity: 'warning', message: 'An orphaned section was excluded from the manuscript.', sectionId: section.id, revisionId: snapshot.revisionsBySectionId[section.id]?.id });
    }

    const citationSections = ordered.flatMap(({ node }) => {
      const section = sectionByNode.get(node.id);
      const revision = section ? snapshot.revisionsBySectionId[section.id] : undefined;
      if (!section || !revision) return [];
      const metadataPlacements = revision.generationMetadata.citationPlacements;
      return [{
        sectionId: section.id,
        revisionId: revision.id,
        supportState: revision.supportState,
        content: revision.content,
        citations: revision.citations as CitationReference[],
        bibliography: revision.bibliography as BibliographyEntry[],
        evidenceTrace: revision.evidenceTrace as EvidenceTrace[],
        ...(Array.isArray(metadataPlacements) ? { citationPlacements: metadataPlacements as CitationPlacementV1[] } : {}),
      }];
    });
    const normalized = this.citationNormalizer.normalize(citationSections);
    const normalizedByRevision = new Map(normalized.sections.map((section) => [section.revisionId, section.content]));
    for (const block of blocks) {
      if (block.kind === 'paragraph') block.text = normalizedByRevision.get(block.revisionId) ?? block.text;
    }
    warnings.push(...normalized.warnings);
    if (normalized.bibliography.length > 0) blocks.push({ kind: 'references', entries: normalized.bibliography });

    const derived = { abstract: missingDerived('ABSTRACT'), keywords: missingDerived('KEYWORDS') };
    warnings.push(
      { code: 'DERIVED_CONTENT_MISSING', severity: 'warning', message: 'The manuscript abstract is missing.', derivedRole: 'ABSTRACT' },
      { code: 'DERIVED_CONTENT_MISSING', severity: 'warning', message: 'The manuscript keywords are missing.', derivedRole: 'KEYWORDS' },
    );
    const bodyFingerprint = computeBodyFingerprint(snapshot);
    const manuscriptFingerprint = sha256Canonical({ version: 'manuscript-v1', bodyFingerprint, abstract: null, keywords: null, citations: normalized.mapping, template: ['generic-academic-v1', '1'], renderer: ['docx', '1'] });
    const acknowledgementCodes = [...new Set(warnings.filter((warning) => warning.severity === 'blocking').map((warning) => warning.code))];
    return {
      schemaVersion: 1,
      projectId: snapshot.project.id,
      title: snapshot.project.selectedTitle ?? null,
      language: snapshot.project.profile.language,
      bodyFingerprint,
      manuscriptFingerprint,
      readiness: warnings.length === 0 ? 'READY' : warnings.some((warning) => warning.severity === 'blocking') ? 'BLOCKED' : 'INCOMPLETE',
      wordCount: blocks.reduce((total, block) => total + (block.kind === 'paragraph' ? countManuscriptWordsV1(block.text) : 0), 0),
      blocks,
      outline: ordered.map(({ node, depth }) => ({ nodeId: node.id, ...(sectionByNode.get(node.id) ? { sectionId: sectionByNode.get(node.id)!.id } : {}), title: node.title, depth, nodeType: node.nodeType })),
      derived,
      supportSummary: { ...support, managedCitationCount: normalized.citations.length, bibliographyEntryCount: normalized.bibliography.length, bibliographyState: normalized.citations.length === 0 ? 'NONE' : normalized.warnings.some((warning) => warning.code === 'BIBLIOGRAPHY_METADATA_UNRESOLVED') ? 'INCOMPLETE' : 'COMPLETE' },
      citations: normalized.citations,
      bibliography: normalized.bibliography,
      warnings,
      exportPolicy: { cleanAllowed: acknowledgementCodes.length === 0, draftAllowed: true, acknowledgementCodes },
    };
  }
}
