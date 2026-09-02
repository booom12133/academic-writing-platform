import type { RenderedToolChunk } from '../execution/tool-execution.types';

export interface TrustedTextSegment {
  section: 'content' | 'references';
  sourceBlockId: string;
  text: string;
}

export function renderedChunksToTrustedSegments(
  chunks: RenderedToolChunk[],
): TrustedTextSegment[] {
  return chunks.flatMap((chunk) => chunk.items.map((item) => ({
    section: chunk.section,
    sourceBlockId: item.provenance.sourceBlockId,
    text: item.text,
  })));
}

export function joinTrustedSegments(segments: TrustedTextSegment[]): string {
  return segments.reduce((result, segment, index) => {
    if (index === 0) return segment.text;
    const previous = segments[index - 1];
    return `${result}${separatorBetween(previous, segment)}${segment.text}`;
  }, '');
}

function separatorBetween(
  previous: TrustedTextSegment,
  current: TrustedTextSegment,
): string {
  if (previous.section === 'references' && current.section === 'references') {
    return previous.sourceBlockId === current.sourceBlockId ? '' : '\n';
  }
  if (previous.section === 'content' && current.section === 'content') {
    return previous.sourceBlockId === current.sourceBlockId ? '' : '\n\n';
  }
  return '\n\n';
}
