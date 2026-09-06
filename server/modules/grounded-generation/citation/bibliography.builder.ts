import type { BibliographyEntry, CitationReference, EvidenceTrace } from '../grounded-generation.types';

export interface BibliographyDiagnostic {
  code: 'bibliography-metadata-unresolved';
  citationId: string;
  field?: string;
}

export interface BibliographyBuildResult {
  entries: BibliographyEntry[];
  diagnostics: BibliographyDiagnostic[];
}

export class BibliographyBuilder {
  build(citations: CitationReference[], traces: EvidenceTrace[]): BibliographyBuildResult {
    const entries: BibliographyEntry[] = [];
    const diagnostics: BibliographyDiagnostic[] = [];
    for (const citation of citations) {
      const trace = citation.evidenceIds
        .map((evidenceId) => traces.find((candidate) => candidate.evidenceId === evidenceId))
        .find((candidate) => candidate !== undefined);
      const metadata = trace?.sourceRecord?.canonicalMetadata;
      if (!metadata) {
        diagnostics.push({ code: 'bibliography-metadata-unresolved', citationId: citation.citationId });
        continue;
      }
      const fields: Record<string, unknown> = {};
      for (const [field, canonicalField] of Object.entries(metadata)) {
        if (canonicalField?.resolutionStatus === 'resolved') {
          fields[field] = canonicalField.value;
        } else {
          diagnostics.push({ code: 'bibliography-metadata-unresolved', citationId: citation.citationId, field });
        }
      }
      if (Object.keys(fields).length === 0) {
        diagnostics.push({ code: 'bibliography-metadata-unresolved', citationId: citation.citationId });
      } else {
        entries.push({ citationId: citation.citationId, fields });
      }
    }
    return { entries, diagnostics };
  }
}
