import type { RenderedToolChunk } from '../execution/tool-execution.types';

export interface TrustedTextSegment {
  section: 'content' | 'references';
  firstSourceBlockId: string;
  lastSourceBlockId: string;
  text: string;
}

export function renderedChunksToTrustedSegments(
  chunks: RenderedToolChunk[],
): TrustedTextSegment[] {
  return chunks.flatMap((chunk) => chunk.items.map((item) => ({
    section: chunk.section,
    firstSourceBlockId: item.provenance.sourceBlockId,
    lastSourceBlockId: item.provenance.sourceBlockId,
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
    return previous.lastSourceBlockId === current.firstSourceBlockId ? '' : '\n';
  }
  if (previous.section === 'content' && current.section === 'content') {
    return previous.lastSourceBlockId === current.firstSourceBlockId ? '' : '\n\n';
  }
  return '\n\n';
}
