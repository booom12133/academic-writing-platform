import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { ZoteroExceptionFilter } from './zotero.exception-filter';
import { ZoteroImportService } from './zotero-import.service';

@Controller('api/zotero')
@UseFilters(ZoteroExceptionFilter)
export class ZoteroController {
  constructor(private readonly service: ZoteroImportService) {}

  @NeedLogin()
  @Post('connection')
  async connect(@Req() req: Request, @Body() body: { apiKey?: unknown }) {
    const userId = req.userContext?.userId;
    if (!userId || typeof body?.apiKey !== 'string' || !body.apiKey) throw new BadRequestException('A Zotero API key is required.');
    return this.service.connect(userId, body.apiKey);
  }

  @NeedLogin()
  @Get('connection/health')
  async health(@Req() req: Request) { return this.service.health(this.requireUser(req)); }

  @NeedLogin()
  @Delete('connection')
  async disconnect(@Req() req: Request) { await this.service.disconnect(this.requireUser(req)); return { status: 'revoked' }; }

  @NeedLogin()
  @Get('items')
  async list(@Req() req: Request) { return this.service.listItems(this.requireUser(req)); }

  @NeedLogin()
  @Post('items/:itemKey/import')
  async importItem(@Req() req: Request, @Param('itemKey') itemKey: string) { return this.service.importItem(this.requireUser(req), itemKey); }

  @NeedLogin()
  @Post('items/:itemKey/sync')
  async syncItem(@Req() req: Request, @Param('itemKey') itemKey: string) { return this.service.syncItem(this.requireUser(req), itemKey); }

  @NeedLogin()
  @Post('attachments/:attachmentKey/import')
  async importAttachment(@Req() req: Request, @Param('attachmentKey') attachmentKey: string) { return this.service.importAttachment(this.requireUser(req), attachmentKey); }

  private requireUser(req: Request): string {
    const userId = req.userContext?.userId;
    if (!userId) throw new Error('Authentication is required.');
    return userId;
  }
}
