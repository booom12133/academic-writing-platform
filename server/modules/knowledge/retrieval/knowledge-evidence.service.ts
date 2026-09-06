import { Inject, Injectable } from '@nestjs/common';
import { KnowledgeRepository, type KnowledgeRepositoryPort } from '../knowledge.repository';
import { EvidenceAssemblyService, type EvidenceSet } from './evidence-assembly';
import {
  KnowledgeRetrievalService,
  type KnowledgeRetrievalInput,
} from './knowledge-retrieval.service';

@Injectable()
export class KnowledgeEvidenceService {
  constructor(
    @Inject(KnowledgeRetrievalService)
    private readonly retrieval: Pick<KnowledgeRetrievalService, 'retrieve'>,
    @Inject(KnowledgeRepository)
    private readonly knowledge: Pick<KnowledgeRepositoryPort, 'getSourceRecord'>,
    private readonly assembly: EvidenceAssemblyService,
  ) {}

  async retrieve(input: KnowledgeRetrievalInput): Promise<EvidenceSet> {
    const retrieval = await this.retrieval.retrieve(input);
    const sourceRecordIds = [
      ...new Set(
        retrieval.items
          .map((item) => item.chunk.provenance.sourceRecordId ?? item.document.sourceRecordId)
          .filter((sourceRecordId): sourceRecordId is string => sourceRecordId !== undefined),
      ),
    ];
    const sourceEntries = await Promise.all(
      sourceRecordIds.map(async (sourceRecordId) => [
        sourceRecordId,
        await this.knowledge.getSourceRecord(input.userId, sourceRecordId),
      ] as const),
    );
    const sources = new Map(
      sourceEntries.flatMap(([sourceRecordId, source]) =>
        source === null ? [] : [[sourceRecordId, source] as const],
      ),
    );
    return this.assembly.assemble(retrieval, sources);
  }
}
