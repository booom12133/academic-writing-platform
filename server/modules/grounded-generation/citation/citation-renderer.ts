import type { BibliographyEntry, GroundedModelOutput } from '../grounded-generation.types';
import type { CitationSemanticsResult } from './citation-semantics.service';

export interface RenderedGroundedContent {
  content: string;
  bibliography: BibliographyEntry[];
}

export class CitationRenderer {
  render(_output: GroundedModelOutput, semantics: Pick<CitationSemanticsResult, 'units' | 'citations'>, bibliography: BibliographyEntry[] = []): RenderedGroundedContent {
    const citationNumber = new Map(
      semantics.citations.map((citation, index) => [citation.citationId, index + 1]),
    );
    const content = semantics.units.map((unit) => {
      const markers = unit.citationIds
        .map((citationId) => citationNumber.get(citationId))
        .filter((number): number is number => number !== undefined)
        .map((number) => `[${number}]`)
        .join('');
      const statusMarker = unit.bindingStatus === 'bound' ? '' : ` [${unit.bindingStatus}]`;
      return `${unit.text}${markers ? ` ${markers}` : ''}${statusMarker}`;
    }).join('\n\n');
    return { content, bibliography };
  }
}
