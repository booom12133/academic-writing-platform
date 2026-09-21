import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { GroundedGenerationService } from '../grounded-generation/grounded-generation.service';
import { GroundedGenerationError } from '../grounded-generation/grounded-generation.errors';
import type { PaperGenerationResponse, PaperProjectSource } from '../../../shared/paper-project.interface';
import { PaperSectionModelGenerator } from './generators/paper-section-model.generator';
import { PaperProjectError, toPaperGenerationError } from './paper-project.errors';
import { PaperProjectRepository } from './paper-project.repository';
import { classifyActualSupport, PaperSourceService } from './paper-source.service';
import { PaperWritingContextBuilder } from './paper-writing-context.builder';

const requestSchema=z.object({operation:z.enum(['GENERATE','REWRITE']),sourceStrategy:z.enum(['MODEL_ONLY','WEB_RETRIEVED','USER_KNOWLEDGE','MIXED']),expectedCurrentRevisionNumber:z.number().int().nonnegative(),baseRevisionId:z.string().uuid().optional(),instructions:z.string().max(10_000).optional(),targetWords:z.number().int().positive().max(50_000).optional()}).strict();
const availabilityPriority=['METADATA_ONLY','INDEX_FAILED','INDEXING','NOT_INDEXED','NO_EVIDENCE'] as const;

@Injectable()
export class PaperGenerationService{
  private readonly contextBuilder=new PaperWritingContextBuilder();
  constructor(private readonly repository:PaperProjectRepository,private readonly sourceService:PaperSourceService,private readonly model:PaperSectionModelGenerator,private readonly grounded:GroundedGenerationService){}
  async generate(userId:string,projectId:string,sectionId:string,body:unknown):Promise<PaperGenerationResponse>{
    const parsed=requestSchema.safeParse(body);if(!parsed.success)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Generation request is invalid.',parsed.error.flatten());
    if(parsed.data.operation==='REWRITE'&&!parsed.data.baseRevisionId)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Rewrite requires a base revision.');
    const [project,section,outline,revisions]=await Promise.all([this.repository.require(userId,projectId),this.repository.getSection(userId,projectId,sectionId),this.repository.listOutline(userId,projectId),this.repository.listRevisions(userId,sectionId)]);
    if(!section||section.status==='archived')throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Paper section was not found.');
    if(section.currentRevisionNumber!==parsed.data.expectedCurrentRevisionNumber)throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT','Paper section changed; reload before generating.',{currentRevisionNumber:section.currentRevisionNumber});
    const selectedNode=outline.find(node=>node.id===section.outlineNodeId);if(!selectedNode)throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Section is not bound to an active writing unit.');
    const base=parsed.data.baseRevisionId?revisions.find(revision=>revision.id===parsed.data.baseRevisionId):undefined;if(parsed.data.baseRevisionId&&!base)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Base revision was not found.');
    const context=this.contextBuilder.build({project,outline,selectedNode,baseRevision:base,instruction:parsed.data.instructions});
    const origin=parsed.data.operation==='REWRITE'?'AI_REWRITE' as const:'AI_GENERATION' as const;
    if(parsed.data.sourceStrategy==='MODEL_ONLY'){
      let generated:Awaited<ReturnType<PaperSectionModelGenerator['generate']>>;
      try{generated=await this.model.generate({context:context.text,targetWords:parsed.data.targetWords??selectedNode.targetWords,instruction:parsed.data.instructions});}catch(error){throw toPaperGenerationError(error);}
      const revision=await this.repository.appendRevision(userId,projectId,sectionId,parsed.data.expectedCurrentRevisionNumber,{content:generated.result.content,baseRevisionId:base?.id,origin,sourceStrategy:'MODEL_ONLY',actualSupportMode:'AI_DRAFT',supportState:'NOT_CLAIMED',citations:[],bibliography:[],evidenceTrace:[],generationMetadata:{...generated.metadata,operation:parsed.data.operation,contextFingerprint:createHash('sha256').update(context.text).digest('hex'),includedSectionIds:context.includedSectionIds,contextWarnings:context.warnings},warnings:[...context.warnings,...generated.result.integrityWarnings],rewriteInstruction:parsed.data.instructions});
      return{revisionCreated:true,evidenceAvailability:'NOT_REQUIRED',revision};
    }
    const sources=await this.sourceService.list(userId,projectId);const selected=this.forStrategy(parsed.data.sourceStrategy,sources);
    if(!selected.length)return{revisionCreated:false,evidenceAvailability:'NO_EVIDENCE',code:'PAPER_EVIDENCE_INSUFFICIENT',safeNextAction:'Select sources matching the requested strategy or explicitly switch to MODEL_ONLY.'};
    const notReady=selected.find(source=>source.evidenceAvailability!=='READY');if(notReady){const availability=availabilityPriority.find(item=>selected.some(source=>source.evidenceAvailability===item))??'NO_EVIDENCE';return{revisionCreated:false,evidenceAvailability:availability,code:`PAPER_SOURCE_${availability}`,safeNextAction:availability==='METADATA_ONLY'?'Import or upload full text, then index it.':'Complete or retry indexing before grounded generation.',affectedSourceIds:selected.filter(source=>source.evidenceAvailability!=='READY').map(source=>source.id)};}
    try{
      const generated=await this.grounded.generate(userId,{instructions:context.text,queryText:`${project.selectedTitle??project.profile.researchIdea}: ${selectedNode.title}`,retrieval:{selection:{mode:'explicit',documentVersionIds:selected.map(source=>source.documentVersionId!)}},output:{format:'markdown',citationStyle:'numeric-inline'},grounding:{onUnbound:'block'}});
      if(generated.status!=='grounded'||!generated.evidenceTrace.length)return{revisionCreated:false,evidenceAvailability:'NO_EVIDENCE',code:'PAPER_EVIDENCE_INSUFFICIENT',safeNextAction:'Adjust the query or selected sources.'};
      const classified=classifyActualSupport(parsed.data.sourceStrategy,generated.evidenceTrace,selected);
      const revision=await this.repository.appendRevision(userId,projectId,sectionId,parsed.data.expectedCurrentRevisionNumber,{content:generated.content,baseRevisionId:base?.id,origin,sourceStrategy:parsed.data.sourceStrategy,actualSupportMode:classified.actualSupportMode,supportState:'VALID',citations:generated.citations,bibliography:generated.bibliography,evidenceTrace:generated.evidenceTrace,generationMetadata:{...generated.generation,operation:parsed.data.operation,selectedVersionIds:generated.provenance.selectedVersionIds,retrievalProfile:generated.provenance.retrievalProfile,contextWarnings:context.warnings},warnings:[...context.warnings,...classified.warnings],rewriteInstruction:parsed.data.instructions});
      return{revisionCreated:true,evidenceAvailability:'READY',revision};
    }catch(error){if(error instanceof GroundedGenerationError){const availability=error.code==='GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE'?'NO_EVIDENCE':'READY';return{revisionCreated:false,evidenceAvailability:availability,code:error.code,safeNextAction:'Adjust sources or instructions and retry; switch to MODEL_ONLY only explicitly.'};}throw error;}
  }
  private forStrategy(strategy:'USER_KNOWLEDGE'|'WEB_RETRIEVED'|'MIXED',sources:PaperProjectSource[]){if(strategy==='USER_KNOWLEDGE')return sources.filter(source=>source.originClass==='USER_KNOWLEDGE');if(strategy==='WEB_RETRIEVED')return sources.filter(source=>source.originClass==='WEB_IMPORTED');const user=sources.some(source=>source.originClass==='USER_KNOWLEDGE'),web=sources.some(source=>source.originClass==='WEB_IMPORTED');return user&&web?sources:[];}
}
