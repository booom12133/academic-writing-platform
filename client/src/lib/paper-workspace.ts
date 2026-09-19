import type { ActualSupportMode, PaperProjectSource, SupportState } from '@shared/paper-project.interface';

export function getSupportBadge(revision:{actualSupportMode:ActualSupportMode;supportState:SupportState}|null|undefined){if(!revision)return'尚无正文';if(revision.supportState==='STALE_AFTER_EDIT')return'已编辑，证据需复核';if(revision.actualSupportMode==='WEB_EVIDENCE')return'有真实文献证据';if(revision.actualSupportMode==='USER_EVIDENCE')return'来自用户资料';if(revision.actualSupportMode==='MIXED_EVIDENCE')return'混合证据';return'模型草稿';}
export interface PaperEditorState{content:string;dirty:boolean;revisionNumber:number;baseRevisionId?:string;}
export const initialPaperEditorState:PaperEditorState={content:'',dirty:false,revisionNumber:0};
export function getSectionSwitchAction(isDirty:boolean):'switch'|'confirm'{return isDirty?'confirm':'switch';}
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
