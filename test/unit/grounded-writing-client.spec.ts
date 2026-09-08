import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';
import type { GroundedGenerationResult } from '../../client/src/api/grounded-generation';
import {
  buildGroundedWritingLocationState,
  buildGroundedWritingMarkdown,
  getGroundedWritingViewState,
  getSelectableKnowledgeSources,
  revalidateGroundedWritingSelection,
} from '../../client/src/lib/grounded-writing';

function workspaceDocument(
  status: KnowledgeWorkspaceDocument['index']['status'] | undefined,
  overrides: Partial<KnowledgeWorkspaceDocument> = {},
): KnowledgeWorkspaceDocument {
  return {
    document: {
      id: `document-${status ?? 'none'}`,
      userId: 'user-1',
      originKind: 'user-upload',
      displayName: 'Paper',
      sourceType: 'pdf',
      activeVersionId: 'version-1',
      lifecycleStatus: 'active',
    },
    activeVersion: {
      id: 'version-1',
      documentId: `document-${status ?? 'none'}`,
      versionNumber: 1,
      readinessStatus: 'content-ready-for-indexing',
      createdAt: '2026-09-08T00:00:00.000Z',
    },
    ...(status === undefined ? {} : {
      index: {
        id: `index-${status}`,
        status,
        totalChunks: 2,
        indexedChunks: status === 'indexed' ? 2 : 1,
        failedChunks: status === 'failed' ? 1 : 0,
      },
    }),
    ...overrides,
  } as KnowledgeWorkspaceDocument;
}

const result: GroundedGenerationResult = {
  schemaVersion: 1,
  status: 'grounded',
  content: 'Grounded content [1].',
  claims: [],
  citations: [],
  bibliography: [{ citationId: 'citation-1', fields: { title: 'Source title', author: 'Author' } }],
  evidenceTrace: [],
  grounding: { groundingCoverage: 'complete', diagnostics: [] },
  provenance: { selectedVersionIds: ['version-1'] },
  generation: { provider: 'test', model: 'test-v1' },
};

describe('grounded writing client helpers', () => {
  it('selects only active versions with indexed materializations', () => {
    const documents = [
      workspaceDocument('indexed'),
      workspaceDocument('failed'),
      workspaceDocument('stale'),
      workspaceDocument('indexing'),
      workspaceDocument(undefined),
      workspaceDocument('indexed', { activeVersion: undefined }),
    ];

    expect(getSelectableKnowledgeSources(documents)).toEqual([
      expect.objectContaining({
        documentVersionId: 'version-1',
        indexStatus: 'indexed',
      }),
    ]);
  });

  it('revalidates continuation state against the current indexed workspace', () => {
    const documents = [workspaceDocument('indexed')];
    expect(revalidateGroundedWritingSelection(
      { documentVersionIds: ['version-1'] },
      documents,
    )).toEqual(['version-1']);
    expect(revalidateGroundedWritingSelection(
      { documentVersionIds: ['version-1', 'stale-version'] },
      documents,
    )).toBeNull();
    expect(revalidateGroundedWritingSelection(
      { documentVersionIds: ['version-1'] },
      [workspaceDocument('stale')],
    )).toBeNull();
  });

  it('keeps continuation state limited to explicit version ids', () => {
    expect(buildGroundedWritingLocationState(['version-1', 'version-2'])).toEqual({
      documentVersionIds: ['version-1', 'version-2'],
    });
    expect(buildGroundedWritingLocationState(['version-1', 'version-1'])).toEqual({
      documentVersionIds: ['version-1'],
    });
  });

  it.each([
    ['idle', { loading: false, error: null, result: null }],
    ['loading', { loading: true, error: null, result: null }],
    ['error', { loading: false, error: 'failed', result: null }],
    ['blocked', { loading: false, error: 'blocked', blocked: true, result: null }],
    ['grounded', { loading: false, error: null, result }],
    ['partial', { loading: false, error: null, result: { ...result, status: 'partial' as const } }],
    ['blocked', { loading: false, error: null, result: { ...result, status: 'blocked' as const } }],
  ] as const)('maps %s result state explicitly', (expected, input) => {
    expect(getGroundedWritingViewState(input)).toBe(expected);
  });

  it('exports only server content and bibliography fields as Markdown', async () => {
    const markdown = buildGroundedWritingMarkdown(result);
    expect(markdown).toContain('Grounded content [1].');
    expect(markdown).toContain('## Bibliography');
    expect(markdown).toContain('citation-1');
    expect(markdown).toContain('title: Source title');
    expect(markdown).not.toContain('version-1');
  });
});
