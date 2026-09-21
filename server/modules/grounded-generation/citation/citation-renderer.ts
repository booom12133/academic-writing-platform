import type { BibliographyEntry, CitationPlacementV1, GroundedModelOutput } from '../grounded-generation.types';
import type { CitationSemanticsResult } from './citation-semantics.service';

export interface RenderedGroundedContent {
  content: string;
  bibliography: BibliographyEntry[];
  citationPlacements: CitationPlacementV1[];
}

export class CitationRenderer {
  render(_output: GroundedModelOutput, semantics: Pick<CitationSemanticsResult, 'units' | 'citations'>, bibliography: BibliographyEntry[] = []): RenderedGroundedContent {
    const citationNumber = new Map(
      semantics.citations.map((citation, index) => [citation.citationId, index + 1]),
    );
    const citationPlacements: CitationPlacementV1[] = [];
    let content = '';
    for (const unit of semantics.units) {
      if (content) content += '\n\n';
      content += unit.text;
      const citations = unit.citationIds
        .map((citationId) => ({ citationId, number: citationNumber.get(citationId) }))
        .filter((item): item is { citationId: string; number: number } => item.number !== undefined);
      if (citations.length) content += ' ';
      for (const citation of citations) {
        const markerText = `[${citation.number}]`;
        const start = content.length;
        content += markerText;
        citationPlacements.push({ schemaVersion: 1, citationId: citation.citationId, localNumber: citation.number, start, end: content.length, markerText });
      }
      const statusMarker = unit.bindingStatus === 'bound' ? '' : ` [${unit.bindingStatus}]`;
      content += statusMarker;
    }
    return { content, bibliography, citationPlacements };
  }
}
