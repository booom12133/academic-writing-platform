import { Injectable } from '@nestjs/common';
import type { OutlineNode, PaperProject, PaperSectionRevision } from '../../../shared/paper-project.interface';

@Injectable()
export class PaperWritingContextBuilder {
  build(input:{project:PaperProject;outline:OutlineNode[];selectedNode:OutlineNode;baseRevision?:PaperSectionRevision;instruction?:string}){
    const warnings:string[]=[];
    const clip=(name:string,value:string,budget:number)=>{if(value.length<=budget)return value;warnings.push(`CONTEXT_TRUNCATED:${name}`);return value.slice(0,budget);};
    const profile=input.project.profile;
    const selected=clip('selectedSection',[
      `Selected section: ${input.selectedNode.title}`,
      input.selectedNode.generationNotes?`Generation notes: ${input.selectedNode.generationNotes}`:'',
    ].filter(Boolean).join('\n'),6_000);
    const instruction=input.instruction?clip('instruction',`User instruction: ${input.instruction}`,8_000):'';
    const base=input.baseRevision?clip('baseRevision',`Base revision:\n${input.baseRevision.content}`,20_050):'';
    const languageDirective=profile.language==='zh-CN'
      ? 'Output language: Write the section in Chinese (zh-CN) unless the user instruction explicitly requests another language.'
      : 'Output language: Write the section in English unless the user instruction explicitly requests another language.';
    const coreProfile=clip('projectProfile',[
      languageDirective,
      `Paper type: ${profile.paperType}`,
      `Research idea: ${profile.researchIdea}`,
      `Selected title: ${input.project.selectedTitle??'Untitled'}`,
      profile.discipline?`Discipline: ${profile.discipline}`:'',
      profile.educationLevel?`Education level: ${profile.educationLevel}`:'',
      profile.requirements?`Requirements: ${profile.requirements}`:'',
      profile.targetWords?`Target words: ${profile.targetWords}`:'',
    ].filter(Boolean).join('\n'),3_000);
    const planning=input.project.researchPlan?clip('researchPlan',`Research plan: ${JSON.stringify(input.project.researchPlan)}`,1_800):'';
    const active=input.outline.filter(node=>node.status==='active');
    const siblings=active.filter(node=>node.parentId===input.selectedNode.parentId).map(node=>node.title);
    const outline=clip('outline',`Outline path and sibling titles: ${siblings.join(' | ')}`,800);
    return {text:[selected,instruction,base,coreProfile,planning,outline].filter(Boolean).join('\n\n'),includedSectionIds:input.baseRevision?[input.baseRevision.sectionId]:[],warnings};
  }
}
