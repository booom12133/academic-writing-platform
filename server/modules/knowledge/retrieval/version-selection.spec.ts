import type {
  KnowledgeDocument,
  KnowledgeDocumentVersion,
} from '../knowledge.types';
import { RetrievalError } from './retrieval.errors';
import { selectVersionScope } from './version-selection';

function candidate(
  documentId: string,
  versionId: string,
  activeVersionId: string | undefined,
  lifecycleStatus: KnowledgeDocumentVersion['lifecycleStatus'] = 'active',
) {
  const document: KnowledgeDocument = {
    id: documentId,
    userId: 'user-1',
    activeVersionId,
    originKind: 'user-upload',
    displayName: documentId,
    sourceType: 'txt',
    lifecycleStatus: 'active',
  };
  const version: KnowledgeDocumentVersion = {
    id: versionId,
    userId: 'user-1',
    documentId,
    versionNumber: versionId === 'version-2' ? 2 : 1,
    originalContentHash: 'a'.repeat(64),
    parserProfile: { name: 'c1-document-parser-v1', version: '1' },
    chunkingProfile: {
      name: 'c3-deterministic-v1',
      version: '1',
      parameters: { maxSize: 100 },
    },
    lifecycleStatus,
    readinessStatus: 'content-ready-for-indexing',
    indexInputFingerprint: 'b'.repeat(64),
    createdAt: '2026-09-06T00:00:00.000Z',
  };
  return { document, version };
}

describe('retrieval version selection', () => {
  it('selects only each document activeVersionId in active mode', () => {
    const candidates = [
      candidate('document-1', 'version-1', 'version-1'),
      candidate('document-1', 'version-2', 'version-1'),
      candidate('document-2', 'version-3', 'version-3'),
    ];

    expect(
      selectVersionScope({ mode: 'active' }, candidates).map((item) => item.version.id),
    ).toEqual(['version-1', 'version-3']);
  });

  it('allows explicit historical versions without replacing them with latest', () => {
    const candidates = [
      candidate('document-1', 'version-1', 'version-2'),
      candidate('document-1', 'version-2', 'version-2'),
    ];

    expect(
      selectVersionScope(
        { mode: 'explicit', documentVersionIds: ['version-1'] },
        candidates,
      ).map((item) => item.version.id),
    ).toEqual(['version-1']);
  });

  it('rejects an explicit version that is unavailable in the owner-safe candidate set', () => {
    expect(() =>
      selectVersionScope(
        { mode: 'explicit', documentVersionIds: ['version-1', 'version-other-user'] },
        [candidate('document-1', 'version-1', 'version-1')],
      ),
    ).toThrow(new RetrievalError('RETRIEVAL_VERSION_SCOPE_INVALID', 'Requested document version was not found.'));
  });

  it('excludes tombstoned versions and returns deterministic document/version order', () => {
    const candidates = [
      candidate('document-2', 'version-3', 'version-3'),
      candidate('document-1', 'version-2', 'version-2', 'tombstoned'),
      candidate('document-1', 'version-1', 'version-1'),
    ];

    expect(
      selectVersionScope({ mode: 'active' }, candidates).map((item) => item.version.id),
    ).toEqual(['version-1', 'version-3']);
  });
});
