import { Inject, Injectable } from '@nestjs/common';
import type { EvidenceSet } from '../../knowledge/retrieval/evidence-assembly';
import {
  KnowledgeEvidenceService,
} from '../../knowledge/retrieval/knowledge-evidence.service';
import type { KnowledgeRetrievalInput } from '../../knowledge/retrieval/knowledge-retrieval.service';

@Injectable()
export class GroundedEvidenceAdapter {
  constructor(
    @Inject(KnowledgeEvidenceService)
    private readonly evidence: Pick<KnowledgeEvidenceService, 'retrieve'>,
  ) {}

  retrieve(input: KnowledgeRetrievalInput): Promise<EvidenceSet> {
    return this.evidence.retrieve(input);
  }
}
