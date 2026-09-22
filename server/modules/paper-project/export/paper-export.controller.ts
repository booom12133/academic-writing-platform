import { Controller, Get, Inject, Param, Req, Res, StreamableFile, UnauthorizedException, UseFilters } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request, Response } from 'express';

import { PaperProjectExceptionFilter } from '../paper-project.exception-filter';
import { PaperExportService } from './paper-export.service';

export class PaperExportController {
  constructor(private readonly exports: PaperExportService) {}
  list(req: Request, projectId: string) { return this.exports.list(this.user(req), projectId); }
  get(req: Request, projectId: string, exportId: string) { return this.exports.get(this.user(req), projectId, exportId); }
  async download(req: Request, projectId: string, exportId: string, response: Response) {
    const artifact = await this.exports.download(this.user(req), projectId, exportId);
    response.setHeader('Content-Type', artifact.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="paper.docx"; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(artifact.buffer);
  }
  private user(req: Request): string {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return userId;
  }
}

Controller('api/paper-projects')(PaperExportController);
UseFilters(PaperProjectExceptionFilter)(PaperExportController);
Inject(PaperExportService)(PaperExportController, undefined, 0);
for (const name of ['list', 'get', 'download'] as const) NeedLogin()(PaperExportController.prototype, name, Object.getOwnPropertyDescriptor(PaperExportController.prototype, name)!);
Get(':projectId/exports')(PaperExportController.prototype, 'list', Object.getOwnPropertyDescriptor(PaperExportController.prototype, 'list')!);
Req()(PaperExportController.prototype, 'list', 0); Param('projectId')(PaperExportController.prototype, 'list', 1);
Get(':projectId/exports/:exportId')(PaperExportController.prototype, 'get', Object.getOwnPropertyDescriptor(PaperExportController.prototype, 'get')!);
Req()(PaperExportController.prototype, 'get', 0); Param('projectId')(PaperExportController.prototype, 'get', 1); Param('exportId')(PaperExportController.prototype, 'get', 2);
Get(':projectId/exports/:exportId/download')(PaperExportController.prototype, 'download', Object.getOwnPropertyDescriptor(PaperExportController.prototype, 'download')!);
Req()(PaperExportController.prototype, 'download', 0); Param('projectId')(PaperExportController.prototype, 'download', 1); Param('exportId')(PaperExportController.prototype, 'download', 2); Res({ passthrough: true })(PaperExportController.prototype, 'download', 3);
