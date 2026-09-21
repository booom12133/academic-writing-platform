import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TopicGenerationGenerator } from '../ai-tools/generators/topic-generation.generator';
import { PaperProjectError, toPaperGenerationError } from './paper-project.errors';
import { PaperProjectRepository } from './paper-project.repository';
import { ResearchPlanGenerator } from './generators/research-plan.generator';
import { PaperOutlineGenerator } from './generators/paper-outline.generator';

const proposalSchema=z.object({expectedLockVersion:z.number().int().nonnegative(),instructions:z.string().max(10_000).optional(),count:z.number().int().min(1).max(10).optional()}).strict();
@Injectable()
export class PaperPlanningService{
  constructor(private readonly projects:PaperProjectRepository,private readonly topics:TopicGenerationGenerator,private readonly plans:ResearchPlanGenerator,private readonly outlines:PaperOutlineGenerator){}
  private async context(userId:string,projectId:string,body:unknown){const request=proposalSchema.safeParse(body);if(!request.success)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Planning request is invalid.',request.error.flatten());const project=await this.projects.require(userId,projectId);if(project.lockVersion!==request.data.expectedLockVersion)throw new PaperProjectError('PAPER_PROJECT_VERSION_CONFLICT','Project changed; reload before generating a proposal.',{current:project});return{project,request:request.data};}
  async generateTopics(userId:string,projectId:string,body:unknown){const{project,request}=await this.context(userId,projectId,body);try{return await this.topics.generate({field:project.profile.discipline,researchDirection:project.profile.researchIdea,educationLevel:project.profile.educationLevel,count:request.count,keywords:request.instructions?[request.instructions]:undefined});}catch(error){throw toPaperGenerationError(error);}}
  async generateResearchPlan(userId:string,projectId:string,body:unknown){const{project,request}=await this.context(userId,projectId,body);try{return await this.plans.generate(project.profile,{selectedTitle:project.selectedTitle,instructions:request.instructions});}catch(error){throw toPaperGenerationError(error);}}
  async generateOutline(userId:string,projectId:string,body:unknown){const{project,request}=await this.context(userId,projectId,body);if(!project.selectedTitle)throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST','Select a paper title before generating an outline.');try{return await this.outlines.generate({title:project.selectedTitle,profile:project.profile,researchPlan:project.researchPlan,requirements:request.instructions});}catch(error){throw toPaperGenerationError(error);}}
}
