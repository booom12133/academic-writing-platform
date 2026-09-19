import { Injectable } from '@nestjs/common';
import type { OutlineNode, PaperProject, PaperSectionRevision } from '../../../shared/paper-project.interface';

@Injectable()
export class PaperWritingContextBuilder {
  build(input:{project:PaperProject;outline:OutlineNode[];selectedNode:OutlineNode;baseRevision?:PaperSectionRevision;instruction?:string}){
    const mandatory=[`Title: ${input.project.selectedTitle??'Untitled'}`,`Research idea: ${input.project.profile.researchIdea}`,`Selected section: ${input.selectedNode.title}`,input.selectedNode.generationNotes?`Notes: ${input.selectedNode.generationNotes}`:'',input.instruction?`Instruction: ${input.instruction}`:''].filter(Boolean);
    const planning=input.project.researchPlan?`Research plan: ${JSON.stringify(input.project.researchPlan)}`:'';
    const outline=`Outline: ${input.outline.filter(node=>node.status==='active').map(node=>node.title).join(' > ')}`;
    const base=input.baseRevision?`Base revision:\n${input.baseRevision.content.slice(0,20_000)}`:'';
    return {text:[...mandatory,planning,outline,base].filter(Boolean).join('\n\n').slice(0,40_000),includedSectionIds:input.baseRevision?[input.baseRevision.sectionId]:[],warnings:[] as string[]};
  }
}
