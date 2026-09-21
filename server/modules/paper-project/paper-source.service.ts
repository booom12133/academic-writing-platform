import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { EvidenceTrace } from '../grounded-generation/grounded-generation.types';
import type { KnowledgeRepositoryPort } from '../knowledge/knowledge.repository';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { KnowledgeIndexRepository } from '../knowledge/indexing/knowledge-index.repository';
import type { PaperProjectSource, SourceStrategy } from '../../../shared/paper-project.interface';
import { projectSourceBindingInputSchema } from './domain/paper-project.schemas';
import { PaperProjectError } from './paper-project.errors';
import { PaperProjectRepository, type CanonicalSourceWrite } from './paper-project.repository';

const replaceSchema=z.object({expectedLockVersion:z.number().int().nonnegative(),bindings:z.array(projectSourceBindingInputSchema).max(100)}).strict();
type KnowledgePort=Pick<KnowledgeRepositoryPort,'getVersion'|'getDocument'|'getSourceRecord'>;
type IndexPort=Pick<KnowledgeIndexRepository,'getLatestIndexForVersion'>;

export function classifyActualSupport(strategy:SourceStrategy,trace:EvidenceTrace[],sources:PaperProjectSource[]){
  const origins=new Set(trace.map(item=>sources.find(source=>source.documentVersionId===item.provenance.documentVersionId)?.originClass).filter(Boolean));
  if(!origins.size)throw new PaperProjectError('PAPER_EVIDENCE_INSUFFICIENT','No cited evidence could be classified.');
  if(origins.has('WEB_IMPORTED')&&origins.has('USER_KNOWLEDGE'))return{actualSupportMode:'MIXED_EVIDENCE' as const,warnings:[]};
  if(origins.has('WEB_IMPORTED'))return{actualSupportMode:'WEB_EVIDENCE' as const,warnings:strategy==='MIXED'?['Requested mixed evidence, but only web evidence was cited.']:[]};
  return{actualSupportMode:'USER_EVIDENCE' as const,warnings:strategy==='MIXED'?['Requested mixed evidence, but only user knowledge was cited.']:[]};
}

@Injectable()
export class PaperSourceService{
  constructor(private readonly projects:PaperProjectRepository,private readonly knowledge:KnowledgeRepository,private readonly indexes:KnowledgeIndexRepository){}
  async replace(userId:string,projectId:string,body:unknown){
    const parsed=replaceSchema.safeParse(body);if(!parsed.success)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Source selection is invalid.',parsed.error.flatten());
    await this.projects.require(userId,projectId);
    const canonical:CanonicalSourceWrite[]=[];
    for(const binding of parsed.data.bindings){
      let sourceRecordId=binding.sourceRecordId;let originClass:'WEB_IMPORTED'|'USER_KNOWLEDGE'='USER_KNOWLEDGE';
      if(binding.documentVersionId){
        const version=await (this.knowledge as KnowledgePort).getVersion!(userId,binding.documentVersionId);if(!version||version.lifecycleStatus!=='active')throw new PaperProjectError('PAPER_SOURCE_OWNERSHIP_MISMATCH','Active Knowledge version was not found.');
        const document=await (this.knowledge as KnowledgePort).getDocument!(userId,version.documentId);if(!document||document.lifecycleStatus!=='active')throw new PaperProjectError('PAPER_SOURCE_OWNERSHIP_MISMATCH','Active Knowledge document was not found.');
        if(sourceRecordId&&document.sourceRecordId!==sourceRecordId)throw new PaperProjectError('PAPER_SOURCE_CANONICAL_CHAIN_MISMATCH','Source and document version do not belong to the same canonical chain.');
        sourceRecordId=sourceRecordId??document.sourceRecordId;
      }
      if(sourceRecordId){const source=await (this.knowledge as KnowledgePort).getSourceRecord(userId,sourceRecordId);if(!source||source.status!=='active')throw new PaperProjectError('PAPER_SOURCE_OWNERSHIP_MISMATCH','Active Knowledge source was not found.');originClass=source.externalProvenance.some(link=>link.connectorKind==='academic-discovery'||link.provider.toLowerCase()==='openalex')?'WEB_IMPORTED':'USER_KNOWLEDGE';}
      if(!binding.documentVersionId&&originClass!=='WEB_IMPORTED')throw new PaperProjectError('PAPER_SOURCE_METADATA_ONLY','Only web discovery records may be bound without a document version.');
      canonical.push({...binding,originClass});
    }
    const saved=await this.projects.replaceSources(userId,projectId,parsed.data.expectedLockVersion,canonical);
    return {...saved,sources:await Promise.all(saved.sources.map(source=>this.withAvailability(userId,source)))};
  }
  async list(userId:string,projectId:string){await this.projects.require(userId,projectId);return Promise.all((await this.projects.listSources(userId,projectId)).map(source=>this.withAvailability(userId,source)));}
  private async withAvailability(userId:string,source:PaperProjectSource):Promise<PaperProjectSource>{
    if(!source.documentVersionId)return{...source,evidenceAvailability:'METADATA_ONLY'};
    const version=await (this.knowledge as KnowledgePort).getVersion!(userId,source.documentVersionId);if(!version||version.lifecycleStatus!=='active')return{...source,evidenceAvailability:'NO_EVIDENCE'};
    const document=await (this.knowledge as KnowledgePort).getDocument!(userId,version.documentId);if(!document||document.lifecycleStatus!=='active'||(source.sourceRecordId&&document.sourceRecordId!==source.sourceRecordId))return{...source,evidenceAvailability:'NO_EVIDENCE'};
    if(source.sourceRecordId){const record=await (this.knowledge as KnowledgePort).getSourceRecord(userId,source.sourceRecordId);if(!record||record.status!=='active')return{...source,evidenceAvailability:'NO_EVIDENCE'};}
    const index=await (this.indexes as IndexPort).getLatestIndexForVersion(userId,source.documentVersionId);
    const status=index?.status;return{...source,evidenceAvailability:status==='indexed'?'READY':status==='indexing'?'INDEXING':status==='failed'||status==='stale'?'INDEX_FAILED':'NOT_INDEXED'};
  }
}
