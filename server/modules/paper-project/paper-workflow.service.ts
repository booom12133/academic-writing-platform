import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PaperProjectRepository, type OutlineWriteNode } from './paper-project.repository';
import { PaperProjectError } from './paper-project.errors';

const outlineNodeSchema = z.object({ id:z.string().uuid().optional(), clientKey:z.string().min(1).max(100), parentClientKey:z.string().min(1).max(100).optional(), nodeType:z.enum(['container','writing-unit']), title:z.string().trim().min(1).max(500), position:z.number().int().nonnegative(), targetWords:z.number().int().positive().optional(), generationNotes:z.string().max(5000).optional() }).strict();
const outlineSchema = z.object({ expectedLockVersion:z.number().int().nonnegative(), nodes:z.array(outlineNodeSchema).min(1).max(200) }).strict();
const saveSchema = z.object({ expectedCurrentRevisionNumber:z.number().int().nonnegative(), baseRevisionId:z.string().uuid().optional(), content:z.string().trim().min(1).max(100000) }).strict();
const restoreSchema=z.object({expectedCurrentRevisionNumber:z.number().int().nonnegative(),revisionId:z.string().uuid()}).strict();
const remapSchema=z.object({expectedLockVersion:z.number().int().nonnegative(),targetOutlineNodeId:z.string().uuid()}).strict();

@Injectable()
export class PaperWorkflowService {
  constructor(private readonly repository: PaperProjectRepository) {}
  async saveOutline(userId:string,projectId:string,body:unknown) {
    const parsed=outlineSchema.safeParse(body); if(!parsed.success) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Outline request is invalid.',parsed.error.flatten());
    const keys=new Set(parsed.data.nodes.map(n=>n.clientKey)); if(keys.size!==parsed.data.nodes.length) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Outline client keys must be unique.');
    const positions=new Set<string>(); for(const node of parsed.data.nodes){ if(node.parentClientKey&&!keys.has(node.parentClientKey)) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Outline parent is missing.'); const key=`${node.parentClientKey??'root'}:${node.position}`; if(positions.has(key)) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Sibling positions must be unique.'); positions.add(key); if(node.nodeType==='writing-unit'&&parsed.data.nodes.some(child=>child.parentClientKey===node.clientKey)) throw new PaperProjectError('PAPER_OUTLINE_INVALID_TREE','Writing units must be leaves.'); }
    return this.repository.replaceOutline(userId,projectId,parsed.data.expectedLockVersion,parsed.data.nodes as OutlineWriteNode[]);
  }
  async saveUserRevision(userId:string,projectId:string,sectionId:string,body:unknown) {
    const parsed=saveSchema.safeParse(body); if(!parsed.success) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Revision request is invalid.',parsed.error.flatten());
    const section=await this.repository.getSection(userId,projectId,sectionId);
    if(!section) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Paper section was not found.');
    if(section.currentRevisionNumber!==parsed.data.expectedCurrentRevisionNumber) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT','Paper section changed; reload before saving.',{currentRevisionNumber:section.currentRevisionNumber});
    const current=(await this.repository.listRevisions(userId,sectionId))[0];
    if(current?.content===parsed.data.content) return {noOp:true,revision:current};
    const supportState=current?.supportState==='VALID'||current?.supportState==='STALE_AFTER_EDIT'?'STALE_AFTER_EDIT':'NOT_CLAIMED';
    const revision=await this.repository.appendRevision(userId,projectId,sectionId,parsed.data.expectedCurrentRevisionNumber,{content:parsed.data.content,baseRevisionId:parsed.data.baseRevisionId,origin:'USER_EDIT',sourceStrategy:current?.sourceStrategy??'MODEL_ONLY',actualSupportMode:current?.actualSupportMode??'AI_DRAFT',supportState,citations:[],bibliography:[],evidenceTrace:[],generationMetadata:{operation:'USER_SAVE'},warnings:supportState==='STALE_AFTER_EDIT'?['Evidence bindings require revalidation after editing.']:[]});
    return {noOp:false,revision};
  }
  async restoreRevision(userId:string,projectId:string,sectionId:string,body:unknown){const parsed=restoreSchema.safeParse(body);if(!parsed.success)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Restore request is invalid.');const source=await this.repository.getRevision(userId,sectionId,parsed.data.revisionId);if(!source)throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND','Revision was not found.');return this.repository.appendRevision(userId,projectId,sectionId,parsed.data.expectedCurrentRevisionNumber,{content:source.content,baseRevisionId:source.id,origin:'USER_EDIT',sourceStrategy:source.sourceStrategy,actualSupportMode:source.actualSupportMode,supportState:source.supportState==='VALID'?'STALE_AFTER_EDIT':source.supportState,citations:source.citations,bibliography:source.bibliography,evidenceTrace:source.evidenceTrace,generationMetadata:{operation:'RESTORE',restoredRevisionId:source.id},warnings:[...source.warnings,'Restored as a new revision; evidence requires review.']});}
  remap(userId:string,projectId:string,sectionId:string,body:unknown){const parsed=remapSchema.safeParse(body);if(!parsed.success)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Remap request is invalid.');return this.repository.remapSection(userId,projectId,sectionId,parsed.data.targetOutlineNodeId,parsed.data.expectedLockVersion);}
}
