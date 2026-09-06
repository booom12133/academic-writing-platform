import type {
  KnowledgeDocument,
  KnowledgeDocumentVersion,
} from '../knowledge.types';
import { RetrievalError } from './retrieval.errors';
import type { RetrievalVersionSelection } from './retrieval.types';

export interface RetrievalVersionCandidate {
  document: KnowledgeDocument;
  version: KnowledgeDocumentVersion;
}

function isRetrievable(candidate: RetrievalVersionCandidate): boolean {
  return (
    candidate.document.lifecycleStatus === 'active' &&
    candidate.version.lifecycleStatus === 'active' &&
    candidate.version.readinessStatus === 'content-ready-for-indexing'
  );
}

export function selectVersionScope(
  selection: RetrievalVersionSelection,
  candidates: RetrievalVersionCandidate[],
): RetrievalVersionCandidate[] {
  const retrievable = candidates.filter(isRetrievable);
  if (selection.mode === 'active') {
    return retrievable
      .filter(
        (candidate) => candidate.document.activeVersionId === candidate.version.id,
      )
      .sort((left, right) =>
        `${left.version.documentId}:${left.version.versionNumber}:${left.version.id}`.localeCompare(
          `${right.version.documentId}:${right.version.versionNumber}:${right.version.id}`,
        ),
      );
  }

  const requestedIds = [...new Set(selection.documentVersionIds)];
  if (requestedIds.length === 0) {
    throw new RetrievalError(
      'RETRIEVAL_VERSION_SCOPE_INVALID',
      'At least one document version is required.',
    );
  }
  const byId = new Map(retrievable.map((candidate) => [candidate.version.id, candidate]));
  if (requestedIds.some((versionId) => !byId.has(versionId))) {
    throw new RetrievalError(
      'RETRIEVAL_VERSION_SCOPE_INVALID',
      'Requested document version was not found.',
    );
  }
  return requestedIds
    .map((versionId) => byId.get(versionId) as RetrievalVersionCandidate)
    .sort((left, right) =>
      `${left.version.documentId}:${left.version.versionNumber}:${left.version.id}`.localeCompare(
        `${right.version.documentId}:${right.version.versionNumber}:${right.version.id}`,
      ),
    );
}
