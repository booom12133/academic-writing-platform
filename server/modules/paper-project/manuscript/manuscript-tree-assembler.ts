import type { OutlineNode } from '../../../../shared/paper-project.interface';
import { PaperProjectError } from '../paper-project.errors';

export interface OrderedOutlineNode {
  node: OutlineNode;
  depth: number;
}

function integrity(message: string): never {
  throw new PaperProjectError('PAPER_MANUSCRIPT_INTEGRITY_FAILURE', message);
}

export function assembleOutlineTree(nodes: OutlineNode[]): OrderedOutlineNode[] {
  const active = nodes.filter((node) => node.status === 'active');
  const byId = new Map(active.map((node) => [node.id, node]));
  if (byId.size !== active.length) integrity('Manuscript outline contains duplicate node identities.');

  const children = new Map<string | null, OutlineNode[]>();
  for (const node of active) {
    if (node.parentId === node.id) integrity('Manuscript outline contains a self-parent cycle.');
    if (node.parentId && !byId.has(node.parentId)) integrity('Manuscript outline contains a missing parent.');
    const key = node.parentId ?? null;
    const siblings = children.get(key) ?? [];
    siblings.push(node);
    children.set(key, siblings);
  }

  for (const siblings of children.values()) {
    const positions = new Set<number>();
    for (const sibling of siblings) {
      if (positions.has(sibling.position)) integrity('Manuscript outline contains a duplicate sibling position.');
      positions.add(sibling.position);
    }
    siblings.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  }

  const ordered: OrderedOutlineNode[] = [];
  const visited = new Set<string>();
  const stack = [...(children.get(null) ?? [])].reverse().map((node) => ({ node, depth: 0 }));
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.node.id)) integrity('Manuscript outline contains a cycle.');
    visited.add(current.node.id);
    ordered.push(current);
    const nested = children.get(current.node.id) ?? [];
    for (let index = nested.length - 1; index >= 0; index -= 1) {
      stack.push({ node: nested[index], depth: current.depth + 1 });
    }
  }
  if (visited.size !== active.length) integrity('Manuscript outline contains an unreachable cycle.');
  return ordered;
}
