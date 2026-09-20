import type { ActualSupportMode, OutlineNode, PaperProjectSource, SupportState } from '@shared/paper-project.interface';

export interface EditableOutlineNode {id?:string;clientKey:string;parentClientKey?:string;nodeType:'container'|'writing-unit';title:string;position:number;targetWords?:number;generationNotes?:string;}
export function toEditableOutline(outline:OutlineNode[]):EditableOutlineNode[]{const active=outline.filter(node=>node.status==='active');const keys=new Map(active.map(node=>[node.id,`persisted:${node.id}`]));return active.map(node=>({id:node.id,clientKey:keys.get(node.id)!,...(node.parentId&&keys.has(node.parentId)?{parentClientKey:keys.get(node.parentId)}:{}),nodeType:node.nodeType,title:node.title,position:node.position,...(node.targetWords?{targetWords:node.targetWords}:{}),...(node.generationNotes?{generationNotes:node.generationNotes}:{})}));}
export function moveOutlineSibling(nodes:EditableOutlineNode[],clientKey:string,direction:'up'|'down'):EditableOutlineNode[]{const current=nodes.find(node=>node.clientKey===clientKey);if(!current)return nodes;const siblings=nodes.filter(node=>node.parentClientKey===current.parentClientKey).sort((a,b)=>a.position-b.position);const index=siblings.findIndex(node=>node.clientKey===clientKey);const target=direction==='up'?index-1:index+1;if(index<0||target<0||target>=siblings.length)return nodes;[siblings[index],siblings[target]]=[siblings[target],siblings[index]];const positions=new Map(siblings.map((node,position)=>[node.clientKey,position]));return nodes.map(node=>positions.has(node.clientKey)?{...node,position:positions.get(node.clientKey)!}:node);}
export function getOutlineProposalSaveAction(mode:'generated'|'saved-edit'|null,hasCurrentOutline:boolean):'save'|'confirm-replace'{return mode==='generated'&&hasCurrentOutline?'confirm-replace':'save';}

export function getSupportBadge(revision:{actualSupportMode:ActualSupportMode;supportState:SupportState}|null|undefined){if(!revision)return'尚无正文';if(revision.supportState==='STALE_AFTER_EDIT')return'已编辑，证据需复核';if(revision.actualSupportMode==='AI_DRAFT')return'模型草稿';if(revision.supportState!=='VALID')return'证据状态待确认';if(revision.actualSupportMode==='WEB_EVIDENCE')return'有真实文献证据';if(revision.actualSupportMode==='USER_EVIDENCE')return'来自用户资料';return'混合证据';}
export interface PaperEditorState{content:string;dirty:boolean;revisionNumber:number;baseRevisionId?:string;}
export const initialPaperEditorState:PaperEditorState={content:'',dirty:false,revisionNumber:0};
export function getSectionSwitchAction(isDirty:boolean):'switch'|'confirm'{return isDirty?'confirm':'switch';}
export function canGenerateSection(sectionId:string,busy:boolean,isDirty:boolean):boolean{return Boolean(sectionId)&&!busy&&!isDirty;}
export function getSourceSelectionTokens(sources:PaperProjectSource[]):Set<string>{return new Set(sources.map(source=>source.documentVersionId?`v:${source.documentVersionId}`:`s:${source.sourceRecordId!}`));}
export function getPaperWorkspaceError(error:unknown):string{
  const record=typeof error==='object'&&error!==null?error as Record<string,unknown>:undefined;
  const response=record&&typeof record.response==='object'&&record.response!==null?record.response as Record<string,unknown>:undefined;
  if(response?.status===409)return'内容已在其他窗口更新，请重新加载后再试。';
  const data=response&&typeof response.data==='object'&&response.data!==null?response.data as Record<string,unknown>:undefined;
  if(typeof data?.message==='string')return data.message;
  return error instanceof Error?error.message:'操作失败，请重试。';
}
export type PaperEditorAction={type:'load';content:string;revisionNumber:number;baseRevisionId?:string}|{type:'edit';content:string}|{type:'saved';revisionNumber:number;baseRevisionId?:string};
export function reducePaperEditorState(state:PaperEditorState,action:PaperEditorAction):PaperEditorState{if(action.type==='load')return{content:action.content,dirty:false,revisionNumber:action.revisionNumber,...(action.baseRevisionId?{baseRevisionId:action.baseRevisionId}:{})};if(action.type==='edit')return{...state,content:action.content,dirty:action.content!==state.content||state.dirty};return{...state,dirty:false,revisionNumber:action.revisionNumber,...(action.baseRevisionId?{baseRevisionId:action.baseRevisionId}:{})};}
