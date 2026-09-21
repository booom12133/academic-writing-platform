import { Controller, Get, Inject, Param, Req, UnauthorizedException, UseFilters } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { PaperProjectExceptionFilter } from '../paper-project.exception-filter';
import { ManuscriptProjectionService } from './manuscript-projection.service';

export class ManuscriptController {
  constructor(private readonly projections: ManuscriptProjectionService) {}
  get(req: Request, projectId: string) {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return this.projections.getProjection(userId, projectId);
  }
}

Controller('api/paper-projects')(ManuscriptController);
UseFilters(PaperProjectExceptionFilter)(ManuscriptController);
Inject(ManuscriptProjectionService)(ManuscriptController, undefined, 0);
NeedLogin()(ManuscriptController.prototype, 'get', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'get')!);
Get(':projectId/manuscript')(ManuscriptController.prototype, 'get', Object.getOwnPropertyDescriptor(ManuscriptController.prototype, 'get')!);
Req()(ManuscriptController.prototype, 'get', 0);
Param('projectId')(ManuscriptController.prototype, 'get', 1);
