import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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

export class KnowledgeProductController {
  constructor(private readonly service: KnowledgeProductService) {}

  async importDocument(req: Request, body: unknown) {
    return this.service.importDocument(this.requireUser(req), body);
  }

  async listDocuments(req: Request) {
    return this.service.listDocuments(this.requireUser(req));
  }

  async listSources(req: Request) {
    return this.service.listSources(this.requireUser(req));
  }

  async getDocument(req: Request, documentId: string) {
    return this.service.getDocument(this.requireUser(req), documentId);
  }

  async indexDocument(req: Request, documentId: string) {
    return this.service.indexActiveVersion(this.requireUser(req), documentId);
  }

  async getIndexStatus(req: Request, documentId: string) {
    return this.service.getIndexStatus(this.requireUser(req), documentId);
  }

  async deleteDocument(req: Request, documentId: string) {
    return this.service.deleteDocument(this.requireUser(req), documentId);
  }

  private requireUser(req: Request): string {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return userId;
  }
}

export class KnowledgeProductIndexController {
  constructor(private readonly service: KnowledgeProductService) {}

  async retryIndex(req: Request, indexId: string) {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return this.service.retryIndex(userId, indexId);
  }
}

export class KnowledgeProductSourceController {
  constructor(private readonly service: KnowledgeProductService) {}
  async listSources(req: Request) {
    const userId = req.userContext?.userId;
    if (!userId) throw new UnauthorizedException('Authentication is required.');
    return this.service.listSources(userId);
  }
}

// Apply Nest metadata through the legacy decorator calling convention.  The
// repository's TypeScript build and Jest use different decorator transforms;
// explicit application keeps these production classes mountable in both.
Controller('api/knowledge/documents')(KnowledgeProductController);
UseFilters(KnowledgeProductExceptionFilter)(KnowledgeProductController);
Inject(KnowledgeProductService)(KnowledgeProductController, undefined, 0);
NeedLogin()(KnowledgeProductController.prototype, 'importDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'importDocument')!);
Post()(KnowledgeProductController.prototype, 'importDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'importDocument')!);
Req()(KnowledgeProductController.prototype, 'importDocument', 0);
Body()(KnowledgeProductController.prototype, 'importDocument', 1);
NeedLogin()(KnowledgeProductController.prototype, 'listDocuments', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'listDocuments')!);
Get()(KnowledgeProductController.prototype, 'listDocuments', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'listDocuments')!);
Req()(KnowledgeProductController.prototype, 'listDocuments', 0);
NeedLogin()(KnowledgeProductController.prototype, 'getDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'getDocument')!);
Get(':documentId')(KnowledgeProductController.prototype, 'getDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'getDocument')!);
Req()(KnowledgeProductController.prototype, 'getDocument', 0);
Param('documentId')(KnowledgeProductController.prototype, 'getDocument', 1);
NeedLogin()(KnowledgeProductController.prototype, 'indexDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'indexDocument')!);
Post(':documentId/index')(KnowledgeProductController.prototype, 'indexDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'indexDocument')!);
Req()(KnowledgeProductController.prototype, 'indexDocument', 0);
Param('documentId')(KnowledgeProductController.prototype, 'indexDocument', 1);
NeedLogin()(KnowledgeProductController.prototype, 'getIndexStatus', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'getIndexStatus')!);
Get(':documentId/index')(KnowledgeProductController.prototype, 'getIndexStatus', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'getIndexStatus')!);
Req()(KnowledgeProductController.prototype, 'getIndexStatus', 0);
Param('documentId')(KnowledgeProductController.prototype, 'getIndexStatus', 1);
NeedLogin()(KnowledgeProductController.prototype, 'deleteDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'deleteDocument')!);
Delete(':documentId')(KnowledgeProductController.prototype, 'deleteDocument', Object.getOwnPropertyDescriptor(KnowledgeProductController.prototype, 'deleteDocument')!);
Req()(KnowledgeProductController.prototype, 'deleteDocument', 0);
Param('documentId')(KnowledgeProductController.prototype, 'deleteDocument', 1);

Controller('api/knowledge/indexes')(KnowledgeProductIndexController);
UseFilters(KnowledgeProductExceptionFilter)(KnowledgeProductIndexController);
Inject(KnowledgeProductService)(KnowledgeProductIndexController, undefined, 0);
NeedLogin()(KnowledgeProductIndexController.prototype, 'retryIndex', Object.getOwnPropertyDescriptor(KnowledgeProductIndexController.prototype, 'retryIndex')!);
Post(':indexId/retry')(KnowledgeProductIndexController.prototype, 'retryIndex', Object.getOwnPropertyDescriptor(KnowledgeProductIndexController.prototype, 'retryIndex')!);
Req()(KnowledgeProductIndexController.prototype, 'retryIndex', 0);
Param('indexId')(KnowledgeProductIndexController.prototype, 'retryIndex', 1);

Controller('api/knowledge/sources')(KnowledgeProductSourceController);
UseFilters(KnowledgeProductExceptionFilter)(KnowledgeProductSourceController);
Inject(KnowledgeProductService)(KnowledgeProductSourceController, undefined, 0);
NeedLogin()(KnowledgeProductSourceController.prototype, 'listSources', Object.getOwnPropertyDescriptor(KnowledgeProductSourceController.prototype, 'listSources')!);
Get()(KnowledgeProductSourceController.prototype, 'listSources', Object.getOwnPropertyDescriptor(KnowledgeProductSourceController.prototype, 'listSources')!);
Req()(KnowledgeProductSourceController.prototype, 'listSources', 0);
