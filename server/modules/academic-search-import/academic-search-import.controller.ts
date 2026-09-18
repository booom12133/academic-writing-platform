import { Body, Controller, HttpCode, Inject, Post, Req, UnauthorizedException, UseFilters } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import { AcademicSearchExceptionFilter } from '../academic-search/academic-search.exception-filter';
import { AcademicSearchImportService } from './academic-search-import.service';
import { AcademicSearchImportExceptionFilter } from './academic-search-import.exception-filter';

export class AcademicSearchImportController {
  constructor(private readonly service: AcademicSearchImportService) {}
  async import(req: Request, body: unknown) {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return this.service.import(userId, body);
  }
}

Controller('api/academic-search/import')(AcademicSearchImportController);
UseFilters(AcademicSearchImportExceptionFilter, AcademicSearchExceptionFilter)(AcademicSearchImportController);
Inject(AcademicSearchImportService)(AcademicSearchImportController, undefined, 0);
NeedLogin()(AcademicSearchImportController.prototype, 'import', Object.getOwnPropertyDescriptor(AcademicSearchImportController.prototype, 'import')!);
Post()(AcademicSearchImportController.prototype, 'import', Object.getOwnPropertyDescriptor(AcademicSearchImportController.prototype, 'import')!);
HttpCode(200)(AcademicSearchImportController.prototype, 'import', Object.getOwnPropertyDescriptor(AcademicSearchImportController.prototype, 'import')!);
Req()(AcademicSearchImportController.prototype, 'import', 0);
Body()(AcademicSearchImportController.prototype, 'import', 1);
