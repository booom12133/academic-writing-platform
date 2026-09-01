import { Module } from '@nestjs/common';
import { FileService } from '@lark-apaas/fullstack-nestjs-core';

import { ChunkingModule } from '../chunking/chunking.module';
import { ContextBuilderModule } from '../context-builder/context-builder.module';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';
import { DocumentInputController } from './document-input.controller';
import { DocumentInputService } from './document-input.service';
import { DOCUMENT_STORAGE } from './document-input.storage';
import { PlatformDocumentStorageAdapter } from './platform-document-storage.adapter';
import { UnavailableDocumentStorageAdapter } from './unavailable-document-storage.adapter';

@Module({
  imports: [DocumentParsingModule, ContextBuilderModule, ChunkingModule],
  controllers: [DocumentInputController],
  providers: [
    DocumentInputService,
    UnavailableDocumentStorageAdapter,
    {
      provide: DOCUMENT_STORAGE,
      inject: [{ token: FileService, optional: true }],
      useFactory: (fileService?: FileService) => fileService
        ? new PlatformDocumentStorageAdapter(fileService)
        : new UnavailableDocumentStorageAdapter(),
    },
  ],
  exports: [DocumentInputService],
})
export class DocumentInputModule {}
