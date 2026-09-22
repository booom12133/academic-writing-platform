import { Body, Controller, Get, Inject, Param, Post, Req, UnauthorizedException, UseFilters } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { PaperProjectExceptionFilter } from '../paper-project.exception-filter';
import { parsePaperUuid } from '../paper-project.errors';
import { ManuscriptProjectionService } from './manuscript-projection.service';
import { DerivedContentService } from './derived-content.service';

export class ManuscriptController {
  constructor(private readonly projections: ManuscriptProjectionService, private readonly derived: DerivedContentService) {}
  get(req: Request, projectId: string) {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return this.projections.getProjection(userId, parsePaperUuid(projectId));
  }
  generateAbstract(req: Request, projectId: string, body: unknown) { return this.derived.generateDerived(this.user(req), parsePaperUuid(projectId), 'ABSTRACT', body); }
  generateKeywords(req: Request, projectId: string, body: unknown) { return this.derived.generateDerived(this.user(req), parsePaperUuid(projectId), 'KEYWORDS', body); }
  refreshConclusion(req: Request, projectId: string, sectionId: string, body: unknown) { return this.derived.refreshConclusion(this.user(req), parsePaperUuid(projectId), parsePaperUuid(sectionId), body); }
  private user(req: Request) { const userId = req.userContext?.userId; if (!userId) throw new UnauthorizedException('Authentication is required.'); return userId; }
}

Controller('api/paper-projects')(ManuscriptController);
UseFilters(PaperProjectExceptionFilter)(ManuscriptController);
Inject(ManuscriptProjectionService)(ManuscriptController, undefined, 0);
Inject(DerivedContentService)(ManuscriptController, undefined, 1);
NeedLogin()(ManuscriptController.prototype, 'get', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'get')!);
Get(':projectId/manuscript')(ManuscriptController.prototype, 'get', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'get')!);
Req()(ManuscriptController.prototype, 'get', 0);
Param('projectId')(ManuscriptController.prototype, 'get', 1);
for (const name of ['generateAbstract', 'generateKeywords', 'refreshConclusion'] as const) NeedLogin()(ManuscriptController.prototype, name, Object.getOwnPropertyDescriptor(ManuscriptController.prototype, name)!);
Post(':projectId/derived/abstract/generate')(ManuscriptController.prototype, 'generateAbstract', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'generateAbstract')!); Req()(ManuscriptController.prototype, 'generateAbstract', 0); Param('projectId')(ManuscriptController.prototype, 'generateAbstract', 1); Body()(ManuscriptController.prototype, 'generateAbstract', 2);
Post(':projectId/derived/keywords/generate')(ManuscriptController.prototype, 'generateKeywords', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'generateKeywords')!); Req()(ManuscriptController.prototype, 'generateKeywords', 0); Param('projectId')(ManuscriptController.prototype, 'generateKeywords', 1); Body()(ManuscriptController.prototype, 'generateKeywords', 2);
Post(':projectId/sections/:sectionId/conclusion-refresh')(ManuscriptController.prototype, 'refreshConclusion', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'refreshConclusion')!); Req()(ManuscriptController.prototype, 'refreshConclusion', 0); Param('projectId')(ManuscriptController.prototype, 'refreshConclusion', 1); Param('sectionId')(ManuscriptController.prototype, 'refreshConclusion', 2); Body()(ManuscriptController.prototype, 'refreshConclusion', 3);
