import type { KnowledgeRepositoryPort } from '../knowledge/knowledge.repository';

export type KnowledgeProductRepository = Required<
  Pick<
    KnowledgeRepositoryPort,
    'listDocuments' | 'getDocument' | 'getVersion' | 'getSourceRecord' | 'listSourceRecords'
  >
>;
