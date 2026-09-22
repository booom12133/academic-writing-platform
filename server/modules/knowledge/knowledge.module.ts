import { Module } from '@nestjs/common';
import { ChunkingModule } from '../chunking/chunking.module';
import { ContextBuilderModule } from '../context-builder/context-builder.module';
import { DocumentInputService } from '../document-input/document-input.service';
import { DOCUMENT_STORAGE, type DocumentStoragePort } from '../document-input/document-input.storage';
import { DocumentParserService } from '../document-parsing/document-parser.service';
import { ChunkingService } from '../chunking/chunking.service';
import { ContextBuilderService } from '../context-builder/context-builder.service';
import { createDocumentStorageProvider } from '../document-input/document-input.storage-provider';
import { DocumentParsingModule } from '../document-parsing/document-parsing.module';
import { KnowledgeRepository } from './knowledge.repository';
import { KnowledgeService } from './knowledge.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule, DocumentParsingModule, ContextBuilderModule, ChunkingModule],
  providers: [
    createDocumentStorageProvider(),
    {
      provide: DocumentInputService,
      useFactory: (
        storage: DocumentStoragePort,
        parser: DocumentParserService,
        contextBuilder: ContextBuilderService,
        chunker: ChunkingService,
      ) => new DocumentInputService(storage, parser, contextBuilder, chunker),
      inject: [DOCUMENT_STORAGE, DocumentParserService, ContextBuilderService, ChunkingService],
    },
    KnowledgeRepository,
    KnowledgeService,
  ],
  exports: [KnowledgeRepository, KnowledgeService],
})
export class KnowledgeModule {}
