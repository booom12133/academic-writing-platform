import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, UnauthorizedException, UseFilters } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { PaperProjectService } from './paper-project.service';
import { PaperProjectExceptionFilter } from './paper-project.exception-filter';
import { PaperProjectRepository } from './paper-project.repository';
import { PaperSourceService } from './paper-source.service';

export class PaperProjectController {
  constructor(private readonly service: PaperProjectService, private readonly repository: PaperProjectRepository, private readonly sources: PaperSourceService) {}
  private user(req: Request) { const id = req.userContext?.userId; if (!id) throw new UnauthorizedException('Authentication is required.'); return id; }
  create(req: Request, body: unknown) { return this.service.create(this.user(req), body); }
  list(req: Request, status?: string) { return this.service.list(this.user(req), status); }
  async get(req: Request, projectId: string) {
    const userId = this.user(req);
    const project = await this.service.get(userId, projectId);
    const [outline, sections, sources] = await Promise.all([
      this.repository.listOutline(userId, projectId, true),
      this.repository.listSections(userId, projectId),
      this.sources.list(userId, projectId),
    ]);
    return { project, outline, sections, sources };
  }
  update(req: Request, projectId: string, body: unknown) { return this.service.update(this.user(req), projectId, body); }
  archive(req: Request, projectId: string, body: unknown) { return this.service.archive(this.user(req), projectId, body); }
  selectTopic(req: Request, projectId: string, body: unknown) { return this.service.selectTopic(this.user(req), projectId, body); }
  getResearchPlan(req: Request, projectId: string) { return this.service.getResearchPlan(this.user(req), projectId); }
  saveResearchPlan(req: Request, projectId: string, body: unknown) { return this.service.saveResearchPlan(this.user(req), projectId, body); }
}

Controller('api/paper-projects')(PaperProjectController); UseFilters(PaperProjectExceptionFilter)(PaperProjectController); [PaperProjectService, PaperProjectRepository, PaperSourceService].forEach((token,index)=>Inject(token)(PaperProjectController, undefined, index));
for (const name of ['create','list','get','update','archive','selectTopic','getResearchPlan','saveResearchPlan'] as const) NeedLogin()(PaperProjectController.prototype, name, Object.getOwnPropertyDescriptor(PaperProjectController.prototype, name)!);
Post()(PaperProjectController.prototype,'create',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'create')!); Req()(PaperProjectController.prototype,'create',0); Body()(PaperProjectController.prototype,'create',1);
Get()(PaperProjectController.prototype,'list',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'list')!); Req()(PaperProjectController.prototype,'list',0); Query('status')(PaperProjectController.prototype,'list',1);
Get(':projectId')(PaperProjectController.prototype,'get',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'get')!); Req()(PaperProjectController.prototype,'get',0); Param('projectId')(PaperProjectController.prototype,'get',1);
Patch(':projectId')(PaperProjectController.prototype,'update',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'update')!); Req()(PaperProjectController.prototype,'update',0); Param('projectId')(PaperProjectController.prototype,'update',1); Body()(PaperProjectController.prototype,'update',2);
Delete(':projectId')(PaperProjectController.prototype,'archive',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'archive')!); Req()(PaperProjectController.prototype,'archive',0); Param('projectId')(PaperProjectController.prototype,'archive',1); Body()(PaperProjectController.prototype,'archive',2);
Put(':projectId/topic-selection')(PaperProjectController.prototype,'selectTopic',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'selectTopic')!); Req()(PaperProjectController.prototype,'selectTopic',0); Param('projectId')(PaperProjectController.prototype,'selectTopic',1); Body()(PaperProjectController.prototype,'selectTopic',2);
Get(':projectId/research-plan')(PaperProjectController.prototype,'getResearchPlan',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'getResearchPlan')!); Req()(PaperProjectController.prototype,'getResearchPlan',0); Param('projectId')(PaperProjectController.prototype,'getResearchPlan',1);
Put(':projectId/research-plan')(PaperProjectController.prototype,'saveResearchPlan',Object.getOwnPropertyDescriptor(PaperProjectController.prototype,'saveResearchPlan')!); Req()(PaperProjectController.prototype,'saveResearchPlan',0); Param('projectId')(PaperProjectController.prototype,'saveResearchPlan',1); Body()(PaperProjectController.prototype,'saveResearchPlan',2);
