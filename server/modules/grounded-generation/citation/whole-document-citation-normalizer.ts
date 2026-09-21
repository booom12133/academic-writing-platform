import type { ManuscriptBibliographyEntry, ManuscriptCitation, ManuscriptWarning } from '../../../../shared/manuscript.interface';
import type { BibliographyEntry, CitationPlacementV1, CitationReference, EvidenceTrace } from '../grounded-generation.types';
import type { SupportState } from '../../../../shared/paper-project.interface';

export interface WholeDocumentCitationSectionInput {
  sectionId: string;
  revisionId: string;
  supportState: SupportState;
  content: string;
  citations: CitationReference[];
  bibliography: BibliographyEntry[];
  evidenceTrace: EvidenceTrace[];
  citationPlacements?: CitationPlacementV1[];
}

export interface CitationMappingEntry {
  sectionId: string;
  localCitationId: string;
  globalNumbers: number[];
}

export interface WholeDocumentCitationNormalizationResult {
  sections: Array<{ sectionId: string; revisionId: string; content: string }>;
  citations: ManuscriptCitation[];
  bibliography: ManuscriptBibliographyEntry[];
  mapping: CitationMappingEntry[];
  warnings: ManuscriptWarning[];
}

interface IdentityEvidence {
  identity: string;
  evidenceId: string;
}

function warning(code: 'CITATION_RENUMBER_UNSAFE' | 'CITATION_IDENTITY_CONFLICT' | 'BIBLIOGRAPHY_METADATA_UNRESOLVED', input: WholeDocumentCitationSectionInput, message: string): ManuscriptWarning {
  return { code, severity: 'blocking', message, sectionId: input.sectionId, revisionId: input.revisionId };
}

function identityFor(trace: EvidenceTrace): IdentityEvidence | null {
  const candidates = [trace.sourceRecord?.id, trace.provenance.sourceRecordId, trace.citationLocator.sourceRecordId].filter((value): value is string => Boolean(value));
  if (new Set(candidates).size > 1) return null;
  const sourceRecordId = candidates[0];
  if (sourceRecordId) return { identity: `source:${sourceRecordId}`, evidenceId: trace.evidenceId };
  const versionCandidates = [trace.provenance.documentVersionId, trace.citationLocator.documentVersionId].filter(Boolean);
  if (new Set(versionCandidates).size !== 1) return null;
  return { identity: `version:${versionCandidates[0]}`, evidenceId: trace.evidenceId };
}

export class WholeDocumentCitationNormalizer {
  normalize(inputs: WholeDocumentCitationSectionInput[]): WholeDocumentCitationNormalizationResult {
    const warnings: ManuscriptWarning[] = [];
    const mapping: CitationMappingEntry[] = [];
    const numberByIdentity = new Map<string, number>();
    const citationByIdentity = new Map<string, ManuscriptCitation>();
    const fieldsByIdentity = new Map<string, Record<string, unknown>>();
    const sections: WholeDocumentCitationNormalizationResult['sections'] = [];

    for (const input of inputs) {
      if (input.supportState !== 'VALID') {
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }
      const citationById = new Map(input.citations.map((citation) => [citation.citationId, citation]));
      const traceById = new Map(input.evidenceTrace.map((trace) => [trace.evidenceId, trace]));
      const placements = input.citationPlacements;
      if (input.citations.length > 0 && (!placements || placements.length === 0)) {
        warnings.push(warning('CITATION_RENUMBER_UNSAFE', input, 'Citation placement metadata is unavailable for this revision.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }
      const replacements: Array<{ start: number; end: number; text: string }> = [];
      let previousEnd = -1;
      let invalidPlacement = false;
      for (const placement of placements ?? []) {
        const citation = citationById.get(placement.citationId);
        if (!citation || placement.start < previousEnd || placement.start < 0 || placement.end <= placement.start || input.content.slice(placement.start, placement.end) !== placement.markerText) {
          invalidPlacement = true;
          break;
        }
        previousEnd = placement.end;
        const identities: IdentityEvidence[] = [];
        for (const evidenceId of citation.evidenceIds) {
          const trace = traceById.get(evidenceId);
          const identity = trace ? identityFor(trace) : null;
          if (!trace || !identity) {
            warnings.push(warning('CITATION_IDENTITY_CONFLICT', input, 'Citation evidence identity is missing or conflicting.'));
            invalidPlacement = true;
            break;
          }
          if (!identities.some((candidate) => candidate.identity === identity.identity)) identities.push(identity);
        }
        if (invalidPlacement || identities.length === 0) break;
        const globalNumbers = identities.map(({ identity }) => {
          let number = numberByIdentity.get(identity);
          if (!number) {
            number = numberByIdentity.size + 1;
            numberByIdentity.set(identity, number);
          }
          return number;
        }).sort((left, right) => left - right);
        mapping.push({ sectionId: input.sectionId, localCitationId: citation.citationId, globalNumbers });
        const bibliography = input.bibliography.find((entry) => entry.citationId === citation.citationId);
        for (const identity of identities) {
          const existingFields = fieldsByIdentity.get(identity.identity);
          if (!bibliography || Object.keys(bibliography.fields).length === 0) {
            warnings.push(warning('BIBLIOGRAPHY_METADATA_UNRESOLVED', input, 'A cited source has no resolved bibliography fields.'));
          } else if (existingFields && JSON.stringify(existingFields) !== JSON.stringify(bibliography.fields)) {
            warnings.push(warning('CITATION_IDENTITY_CONFLICT', input, 'Immutable bibliography snapshots conflict for the same source identity.'));
          } else if (!existingFields) {
            fieldsByIdentity.set(identity.identity, bibliography.fields);
          }
          const existingCitation = citationByIdentity.get(identity.identity) ?? { number: numberByIdentity.get(identity.identity)!, identity: identity.identity, contributors: [] };
          existingCitation.contributors.push({ sectionId: input.sectionId, revisionId: input.revisionId, localCitationId: citation.citationId, evidenceId: identity.evidenceId });
          citationByIdentity.set(identity.identity, existingCitation);
        }
        replacements.push({ start: placement.start, end: placement.end, text: globalNumbers.map((number) => `[${number}]`).join('') });
      }
      if (invalidPlacement) {
        if (!warnings.some((item) => item.sectionId === input.sectionId && item.code === 'CITATION_IDENTITY_CONFLICT')) warnings.push(warning('CITATION_RENUMBER_UNSAFE', input, 'Citation placement metadata does not match the immutable revision text.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }
      let content = input.content;
      for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        content = `${content.slice(0, replacement.start)}${replacement.text}${content.slice(replacement.end)}`;
      }
      sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content });
    }

    const citations = [...citationByIdentity.values()].sort((left, right) => left.number - right.number);
    const bibliography = citations
      .filter((citation) => fieldsByIdentity.has(citation.identity))
      .map((citation) => ({ number: citation.number, identity: citation.identity, fields: fieldsByIdentity.get(citation.identity)! }));
    return { sections, citations, bibliography, mapping, warnings };
  }
}
