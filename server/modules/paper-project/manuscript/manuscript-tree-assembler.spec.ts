import type { OutlineNode } from '../../../../shared/paper-project.interface';
import { assembleOutlineTree } from './manuscript-tree-assembler';

const node = (input: Partial<OutlineNode> & Pick<OutlineNode, 'id' | 'title' | 'position'>): OutlineNode => ({
  nodeType: 'writing-unit',
  status: 'active',
  ...input,
});

describe('assembleOutlineTree', () => {
  it('orders every sibling group before iterative depth-first traversal', () => {
    const result = assembleOutlineTree([
      node({ id: 'child-b', parentId: 'root', title: 'B', position: 1 }),
      node({ id: 'root-2', title: 'Second root', position: 1, nodeType: 'container' }),
      node({ id: 'root', title: 'First root', position: 0, nodeType: 'container' }),
      node({ id: 'grandchild', parentId: 'child-a', title: 'A.1', position: 0 }),
      node({ id: 'child-a', parentId: 'root', title: 'A', position: 0, nodeType: 'container' }),
    ]);

    expect(result.map(({ node: item, depth }) => [item.id, depth])).toEqual([
      ['root', 0],
      ['child-a', 1],
      ['grandchild', 2],
      ['child-b', 1],
      ['root-2', 0],
    ]);
  });

  it.each([
    [[node({ id: 'a', parentId: 'missing', title: 'A', position: 0 })], 'missing parent'],
    [[node({ id: 'a', parentId: 'b', title: 'A', position: 0 }), node({ id: 'b', parentId: 'a', title: 'B', position: 0 })], 'cycle'],
    [[node({ id: 'a', title: 'A', position: 0 }), node({ id: 'b', title: 'B', position: 0 })], 'duplicate sibling position'],
  ])('fails closed for %s', (nodes, _caseName) => {
    expect(() => assembleOutlineTree(nodes as OutlineNode[])).toThrow(expect.objectContaining({
      code: 'PAPER_MANUSCRIPT_INTEGRITY_FAILURE',
    }));
  });
});
