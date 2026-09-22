import type { ManuscriptSnapshot, WholeManuscriptGenerationContextV1 } from '../../../../shared/manuscript.interface';
import { PaperProjectError } from '../paper-project.errors';
import { assembleOutlineTree } from './manuscript-tree-assembler';
import { canonicalJson, sha256Canonical } from './manuscript-fingerprint';

const BUDGET = 60_000 as const;
const MINIMUM_SECTION_COVERAGE = 128;
const codePoints = (value: string) => Array.from(value);
const length = (value: string) => codePoints(value).length;

export interface WholeManuscriptContextBuildInput {
  snapshot: ManuscriptSnapshot;
  operation: 'ABSTRACT' | 'KEYWORDS' | 'CONCLUSION_REFRESH';
  targetSectionId?: string;
  instructions?: string;
}

function truncateHeadMiddleTail(content: string, quota: number): { text: string; included: number } {
  const source = codePoints(content);
  if (source.length <= quota) return { text: content, included: source.length };
  let available = quota;
  let delimiter = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const omitted = source.length - available;
    delimiter = `\n[… omitted ${omitted} code points …]\n`;
    const next = quota - (length(delimiter) * 2);
    if (next === available) break;
    available = next;
  }
  if (available < 3) throw new PaperProjectError('PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE', 'The manuscript context cannot truthfully represent every section.');
  const headLength = Math.max(1, Math.floor(available * 0.4));
  const middleLength = Math.max(1, Math.floor(available * 0.2));
  const tailLength = available - headLength - middleLength;
  const middleStart = Math.max(headLength, Math.floor((source.length - middleLength) / 2));
  return {
    text: `${source.slice(0, headLength).join('')}${delimiter}${source.slice(middleStart, middleStart + middleLength).join('')}${delimiter}${source.slice(-tailLength).join('')}`,
    included: headLength + middleLength + tailLength,
  };
}

export class WholeManuscriptGenerationContextBuilder {
  build(input: WholeManuscriptContextBuildInput): WholeManuscriptGenerationContextV1 {
    const ordered = assembleOutlineTree(input.snapshot.outline);
    const sectionByNode = new Map(input.snapshot.sections
      .filter((section) => section.sectionRole === 'OUTLINE' && section.status === 'active' && section.outlineNodeId)
      .map((section) => [section.outlineNodeId!, section]));
    const eligible = ordered.flatMap(({ node }) => {
      const section = sectionByNode.get(node.id);
      const revision = section ? input.snapshot.revisionsBySectionId[section.id] : undefined;
      return section && revision && section.id !== input.targetSectionId
        ? [{ sectionId: section.id, heading: node.title, content: revision.content }]
        : [];
    });
    const envelope = [
      '[whole-manuscript-context-v1]',
      `Operation: ${input.operation}`,
      `Language: ${input.snapshot.project.profile.language}`,
      `Title: ${input.snapshot.project.selectedTitle ?? ''}`,
      `Research Plan: ${canonicalJson(input.snapshot.project.researchPlan ?? null)}`,
      `Outline:\n${ordered.map(({ node, depth }) => `${'  '.repeat(depth)}- ${node.title}`).join('\n')}`,
      ...(input.targetSectionId ? [`Target section: ${input.targetSectionId} (content excluded)`] : []),
      ...(input.instructions ? [`User instructions: ${input.instructions}`] : []),
    ].join('\n');
    const headers = eligible.map((section) => `\n\n## ${section.heading} [${section.sectionId}]\n`);
    const fixedLength = length(envelope) + headers.reduce((sum, header) => sum + length(header), 0);
    if (fixedLength > BUDGET) throw new PaperProjectError('PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE', 'The required manuscript context envelope exceeds the safe budget.');
    const available = BUDGET - fixedLength;
    const sourceLengths = eligible.map((section) => length(section.content));
    const minimums = sourceLengths.map((sourceLength) => Math.min(MINIMUM_SECTION_COVERAGE, sourceLength));
    if (minimums.reduce((sum, value) => sum + value, 0) > available) throw new PaperProjectError('PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE', 'The safe context budget cannot cover every manuscript section.');
    const allocations = [...minimums];
    let remaining = available - allocations.reduce((sum, value) => sum + value, 0);
    while (remaining > 0) {
      const open = allocations.map((value, index) => ({ index, need: sourceLengths[index] - value })).filter(({ need }) => need > 0);
      if (open.length === 0) break;
      const share = Math.max(1, Math.floor(remaining / open.length));
      let distributed = 0;
      for (const { index, need } of open) {
        const addition = Math.min(need, share, remaining - distributed);
        allocations[index] += addition;
        distributed += addition;
        if (distributed === remaining) break;
      }
      if (distributed === 0) break;
      remaining -= distributed;
    }

    const truncatedSections: WholeManuscriptGenerationContextV1['metadata']['truncatedSections'] = [];
    const allocationMetadata: WholeManuscriptGenerationContextV1['metadata']['allocations'] = [];
    const represented = eligible.map((section, index) => {
      const excerpt = truncateHeadMiddleTail(section.content, allocations[index]);
      if (sourceLengths[index] > allocations[index]) truncatedSections.push({ sectionId: section.sectionId, originalCodePoints: sourceLengths[index], includedCodePoints: excerpt.included, strategy: 'HEAD_MIDDLE_TAIL' });
      allocationMetadata.push({ sectionId: section.sectionId, allocatedCodePoints: allocations[index], includedCodePoints: excerpt.included });
      return `${headers[index]}${excerpt.text}`;
    });
    const text = `${envelope}${represented.join('')}`;
    if (length(text) > BUDGET) throw new PaperProjectError('PAPER_MANUSCRIPT_CONTEXT_UNREPRESENTABLE', 'The assembled manuscript context exceeds the safe budget.');
    const metadata: WholeManuscriptGenerationContextV1['metadata'] = {
      budgetCodePoints: BUDGET,
      sourceBodyCodePoints: sourceLengths.reduce((sum, value) => sum + value, 0),
      includedSectionIds: eligible.map((section) => section.sectionId),
      truncatedSections,
      allocations: allocationMetadata,
      warnings: truncatedSections.length ? ['WHOLE_MANUSCRIPT_CONTEXT_TRUNCATED'] : [],
    };
    return { version: 1, text, contextFingerprint: sha256Canonical({ metadata, represented }), metadata };
  }
}
