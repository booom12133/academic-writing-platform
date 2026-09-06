import type {
  CitationLocator,
  KnowledgeChunk,
  KnowledgeChunkProvenance,
  SourceRecord,
} from '../knowledge.types';
import type { RetrievalResult, RetrievalResultItem } from './knowledge-retrieval.service';

export interface EvidenceDiagnostic {
  code: 'profile-unavailable' | 'threshold-excluded' | 'source-unavailable';
  documentVersionId?: string;
  sourceRecordId?: string;
}

export interface EvidenceItem {
  evidenceId: string;
  knowledgeChunkId: string;
  chunk: KnowledgeChunk;
  text: string;
  provenance: KnowledgeChunkProvenance;
  citationLocator: CitationLocator;
  sourceIdentity?: SourceRecord;
  rank: number;
  rawDistance: number;
  retrievalScore: number;
}

export interface EvidenceSet {
  status: RetrievalResult['status'];
  selectedVersionIds: string[];
  items: EvidenceItem[];
  diagnostics: EvidenceDiagnostic[];
  profile: RetrievalResult['profile'];
}

export class EvidenceAssemblyService {
  assemble(
    retrieval: RetrievalResult,
    sources: ReadonlyMap<string, SourceRecord> = new Map(),
  ): EvidenceSet {
    const seenChunkIds = new Set<string>();
    const diagnostics: EvidenceDiagnostic[] = [...retrieval.diagnostics];
    const items: EvidenceItem[] = [];

    for (const item of retrieval.items) {
      if (seenChunkIds.has(item.chunk.id)) continue;
      seenChunkIds.add(item.chunk.id);
      const sourceRecordId = item.chunk.provenance.sourceRecordId ?? item.document.sourceRecordId;
      const sourceIdentity = sourceRecordId === undefined ? undefined : sources.get(sourceRecordId);
      if (sourceRecordId !== undefined && sourceIdentity === undefined) {
        diagnostics.push({
          code: 'source-unavailable',
          documentVersionId: item.version.id,
          sourceRecordId,
        });
      }
      items.push(toEvidenceItem(item, sourceIdentity));
    }

    return {
      status: diagnostics.length > 0 ? 'partial' : retrieval.status,
      selectedVersionIds: [...retrieval.selectedVersionIds],
      items,
      diagnostics,
      profile: retrieval.profile,
    };
  }
}

function toEvidenceItem(item: RetrievalResultItem, sourceIdentity?: SourceRecord): EvidenceItem {
  return {
    evidenceId: `chunk:${item.chunk.id}`,
    knowledgeChunkId: item.chunk.id,
    chunk: item.chunk,
    text: item.chunk.text,
    provenance: item.chunk.provenance,
    citationLocator: item.chunk.citationLocator,
    ...(sourceIdentity === undefined ? {} : { sourceIdentity }),
    rank: item.rank,
    rawDistance: item.rawDistance,
    retrievalScore: item.retrievalScore,
  };
}
