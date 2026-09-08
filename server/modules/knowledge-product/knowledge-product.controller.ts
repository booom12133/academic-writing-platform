import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { KnowledgeProductExceptionFilter } from './knowledge-product.exception-filter';
import { KnowledgeProductService } from './knowledge-product.service';

@Controller('api/knowledge/documents')
@UseFilters(KnowledgeProductExceptionFilter)
export class KnowledgeProductController {
  constructor(private readonly service: KnowledgeProductService) {}

  @NeedLogin()
  @Post()
  async importDocument(@Req() req: Request, @Body() body: unknown) {
    return this.service.importDocument(this.requireUser(req), body);
  }

  @NeedLogin()
  @Get()
  async listDocuments(@Req() req: Request) {
    return this.service.listDocuments(this.requireUser(req));
  }

  @NeedLogin()
  @Get(':documentId')
  async getDocument(@Req() req: Request, @Param('documentId') documentId: string) {
    return this.service.getDocument(this.requireUser(req), documentId);
  }

  @NeedLogin()
  @Delete(':documentId')
  async deleteDocument(@Req() req: Request, @Param('documentId') documentId: string) {
    return this.service.deleteDocument(this.requireUser(req), documentId);
  }

  private requireUser(req: Request): string {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return userId;
  }
}
