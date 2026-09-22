import { createHash } from 'node:crypto';
import type { ManuscriptSnapshot } from '../../../../shared/manuscript.interface';
import { assembleOutlineTree } from './manuscript-tree-assembler';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function computeBodyFingerprint(snapshot: ManuscriptSnapshot): string {
  const sectionByNode = new Map(snapshot.sections
    .filter((section) => section.sectionRole === 'OUTLINE' && section.status === 'active' && section.outlineNodeId)
    .map((section) => [section.outlineNodeId!, section]));
  const outline = assembleOutlineTree(snapshot.outline).map(({ node }) => {
    const section = sectionByNode.get(node.id);
    const revision = section ? snapshot.revisionsBySectionId[section.id] : undefined;
    return {
      id: node.id,
      parentId: node.parentId ?? null,
      nodeType: node.nodeType,
      title: node.title,
      position: node.position,
      sectionId: section?.id ?? null,
      revision: revision ? { id: revision.id, revisionNumber: revision.revisionNumber, contentHash: revision.contentHash } : null,
    };
  });
  return sha256Canonical({
    version: 'manuscript-body-v1',
    selectedTitle: snapshot.project.selectedTitle ?? null,
    researchPlan: snapshot.project.researchPlan ?? null,
    outline,
  });
}

export function computeConclusionBasisFingerprint(snapshot: ManuscriptSnapshot, targetSectionId: string): string {
  const sectionByNode = new Map(snapshot.sections
    .filter((section) => section.sectionRole === 'OUTLINE' && section.status === 'active' && section.outlineNodeId)
    .map((section) => [section.outlineNodeId!, section]));
  const outline = assembleOutlineTree(snapshot.outline).map(({ node }) => {
    const section = sectionByNode.get(node.id);
    if (!section) return { id: node.id, parentId: node.parentId ?? null, nodeType: node.nodeType, title: node.title, position: node.position, sectionId: null, revision: null };
    if (section.id === targetSectionId) return { id: node.id, parentId: node.parentId ?? null, nodeType: node.nodeType, title: node.title, position: node.position, sectionId: section.id, excluded: true };
    const revision = snapshot.revisionsBySectionId[section.id];
    return { id: node.id, parentId: node.parentId ?? null, nodeType: node.nodeType, title: node.title, position: node.position, sectionId: section.id, revision: revision ? { id: revision.id, revisionNumber: revision.revisionNumber, contentHash: revision.contentHash } : null };
  });
  return sha256Canonical({ version: 'conclusion-basis-v1', selectedTitle: snapshot.project.selectedTitle ?? null, researchPlan: snapshot.project.researchPlan ?? null, outline });
}

export function countManuscriptWordsV1(text: string): number {
  let nonCjk = '';
  let cjkCount = 0;
  for (const codePoint of text) {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(codePoint)) {
      cjkCount += 1;
      nonCjk += ' ';
    } else {
      nonCjk += codePoint;
    }
  }
  return cjkCount + (nonCjk.match(/[\p{L}\p{N}]+/gu)?.length ?? 0);
}
