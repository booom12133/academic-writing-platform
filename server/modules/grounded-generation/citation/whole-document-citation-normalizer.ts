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
  const versionCandidates = [trace.provenance.documentVersionId, trace.citationLocator.documentVersionId].filter((value): value is string => Boolean(value));
  if (new Set(versionCandidates).size > 1) return null;
  const sourceRecordId = candidates[0];
  if (sourceRecordId) return { identity: `source:${sourceRecordId}`, evidenceId: trace.evidenceId };
  if (new Set(versionCandidates).size !== 1) return null;
  return { identity: `version:${versionCandidates[0]}`, evidenceId: trace.evidenceId };
}

function sameFields(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonical(nested)]))
      : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export class WholeDocumentCitationNormalizer {
  normalize(inputs: WholeDocumentCitationSectionInput[]): WholeDocumentCitationNormalizationResult {
    const warnings: ManuscriptWarning[] = [];
    const mapping: CitationMappingEntry[] = [];
    let numberByIdentity = new Map<string, number>();
    let citationByIdentity = new Map<string, ManuscriptCitation>();
    let fieldsByIdentity = new Map<string, Record<string, unknown>>();
    const sections: WholeDocumentCitationNormalizationResult['sections'] = [];

    for (const input of inputs) {
      if (input.supportState !== 'VALID') {
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }
      const placements = input.citationPlacements;
      if (input.citations.length === 0) {
        if ((placements?.length ?? 0) > 0 || input.bibliography.length > 0 || input.evidenceTrace.length > 0) {
          warnings.push(warning('CITATION_RENUMBER_UNSAFE', input, 'Citation snapshot metadata is inconsistent.'));
        }
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }
      if (!placements || placements.length === 0) {
        warnings.push(warning('CITATION_RENUMBER_UNSAFE', input, 'Citation placement metadata is unavailable for this revision.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }

      const citationById = new Map(input.citations.map((citation) => [citation.citationId, citation]));
      const traceById = new Map(input.evidenceTrace.map((trace) => [trace.evidenceId, trace]));
      const bibliographyById = new Map(input.bibliography.map((entry) => [entry.citationId, entry]));
      if (citationById.size !== input.citations.length || traceById.size !== input.evidenceTrace.length || bibliographyById.size !== input.bibliography.length) {
        warnings.push(warning('CITATION_IDENTITY_CONFLICT', input, 'Citation snapshot identifiers must be unique.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }

      let previousEnd = -1;
      let invalidPlacement = false;
      const coveredCitationIds = new Set<string>();
      const localNumberByCitation = new Map(input.citations.map((citation, index) => [citation.citationId, index + 1]));
      for (const placement of placements) {
        const citation = citationById.get(placement.citationId);
        const expectedLocalNumber = localNumberByCitation.get(placement.citationId);
        if (!citation || placement.schemaVersion !== 1 || placement.localNumber !== expectedLocalNumber || placement.markerText !== `[${placement.localNumber}]`
          || !Number.isInteger(placement.start) || !Number.isInteger(placement.end) || placement.start < previousEnd || placement.start < 0
          || placement.end <= placement.start || input.content.slice(placement.start, placement.end) !== placement.markerText) {
          invalidPlacement = true;
          break;
        }
        previousEnd = placement.end;
        coveredCitationIds.add(placement.citationId);
      }
      if (!invalidPlacement && input.citations.some((citation) => !coveredCitationIds.has(citation.citationId))) invalidPlacement = true;
      if (invalidPlacement) {
        warnings.push(warning('CITATION_RENUMBER_UNSAFE', input, 'Citation placement metadata does not match the immutable revision text.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }

      const identityEvidenceByCitation = new Map<string, IdentityEvidence[]>();
      let invalidIdentity = false;
      for (const citation of input.citations) {
        if (citation.evidenceIds.length === 0 || new Set(citation.evidenceIds).size !== citation.evidenceIds.length) {
          invalidIdentity = true;
          break;
        }
        const identities: IdentityEvidence[] = [];
        for (const evidenceId of citation.evidenceIds) {
          const trace = traceById.get(evidenceId);
          const identity = trace ? identityFor(trace) : null;
          if (!trace || !identity) {
            invalidIdentity = true;
            break;
          }
          identities.push(identity);
        }
        if (invalidIdentity || identities.length === 0) break;
        identityEvidenceByCitation.set(citation.citationId, identities);
      }
      if (invalidIdentity) {
        warnings.push(warning('CITATION_IDENTITY_CONFLICT', input, 'Citation evidence identity is missing, duplicated, or conflicting.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }

      const stagedFields = new Map(fieldsByIdentity);
      const stagedWarnings: ManuscriptWarning[] = [];
      for (const citation of input.citations) {
        const bibliography = bibliographyById.get(citation.citationId);
        const identities = [...new Set(identityEvidenceByCitation.get(citation.citationId)!.map(({ identity }) => identity))];
        for (const identity of identities) {
          const existingFields = stagedFields.get(identity);
          if (!bibliography || Object.keys(bibliography.fields).length === 0) {
            stagedWarnings.push(warning('BIBLIOGRAPHY_METADATA_UNRESOLVED', input, 'A cited source has no resolved bibliography fields.'));
          } else if (existingFields && !sameFields(existingFields, bibliography.fields)) {
            invalidIdentity = true;
          } else if (!existingFields) {
            stagedFields.set(identity, bibliography.fields);
          }
        }
      }
      if (invalidIdentity) {
        warnings.push(warning('CITATION_IDENTITY_CONFLICT', input, 'Immutable bibliography snapshots conflict for the same source identity.'));
        sections.push({ sectionId: input.sectionId, revisionId: input.revisionId, content: input.content });
        continue;
      }

      const stagedNumbers = new Map(numberByIdentity);
      const stagedCitations = new Map([...citationByIdentity].map(([identity, citation]) => [identity, { ...citation, contributors: [...citation.contributors] }]));
      const stagedMapping: CitationMappingEntry[] = [];
      const replacements: Array<{ start: number; end: number; text: string }> = [];
      const processedCitationIds = new Set<string>();
      for (const placement of placements) {
        const identityEvidence = identityEvidenceByCitation.get(placement.citationId)!;
        const identities = [...new Set(identityEvidence.map(({ identity }) => identity))];
        const globalNumbers = identities.map((identity) => {
          let number = stagedNumbers.get(identity);
          if (!number) {
            number = stagedNumbers.size + 1;
            stagedNumbers.set(identity, number);
          }
          return number;
        }).sort((left, right) => left - right);
        if (!processedCitationIds.has(placement.citationId)) {
          stagedMapping.push({ sectionId: input.sectionId, localCitationId: placement.citationId, globalNumbers });
          for (const item of identityEvidence) {
            const existingCitation = stagedCitations.get(item.identity) ?? { number: stagedNumbers.get(item.identity)!, identity: item.identity, contributors: [] };
            existingCitation.contributors.push({ sectionId: input.sectionId, revisionId: input.revisionId, localCitationId: placement.citationId, evidenceId: item.evidenceId });
            stagedCitations.set(item.identity, existingCitation);
          }
          processedCitationIds.add(placement.citationId);
        }
        replacements.push({ start: placement.start, end: placement.end, text: globalNumbers.map((number) => `[${number}]`).join('') });
      }
      numberByIdentity = stagedNumbers;
      citationByIdentity = stagedCitations;
      fieldsByIdentity = stagedFields;
      mapping.push(...stagedMapping);
      warnings.push(...stagedWarnings);
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
