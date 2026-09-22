import { Module } from '@nestjs/common';

import { ChunkingModule } from '../chunking/chunking.module';
import { ContextBuilderModule } from '../context-builder/context-builder.module';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';
import { DocumentInputController } from './document-input.controller';
import { DocumentInputService } from './document-input.service';
import { createDocumentStorageProvider } from './document-input.storage-provider';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule, DocumentParsingModule, ContextBuilderModule, ChunkingModule],
  controllers: [DocumentInputController],
  providers: [
    DocumentInputService,
    createDocumentStorageProvider(),
  ],
  exports: [DocumentInputService],
})
export class DocumentInputModule {}
