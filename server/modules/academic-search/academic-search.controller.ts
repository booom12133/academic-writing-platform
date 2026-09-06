import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { AcademicSearchError } from './academic-search.errors';
import { AcademicSearchExceptionFilter } from './academic-search.exception-filter';
import { AcademicSearchService } from './academic-search.service';
import type { AcademicSearchRequest } from './academic-search.types';

@Controller('api/academic-search')
@UseFilters(AcademicSearchExceptionFilter)
export class AcademicSearchController {
  constructor(private readonly service: AcademicSearchService) {}

  @NeedLogin()
  @HttpCode(HttpStatus.OK)
  @Post('search')
  async search(@Req() req: Request, @Body() body: AcademicSearchRequest) {
    const userId = req.userContext?.userId;
    if (!userId) throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_QUERY', 'The academic search query is invalid.');
    return this.service.search(body, userId);
  }
}
