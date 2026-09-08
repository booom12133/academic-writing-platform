import { Module } from '@nestjs/common';

import { DocumentInputModule } from '../document-input/document-input.module';
import { KnowledgeIndexingModule } from '../knowledge/indexing/knowledge-indexing.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import {
  KnowledgeProductController,
  KnowledgeProductIndexController,
} from './knowledge-product.controller';
import { KnowledgeProductIndexingService } from './knowledge-product.indexing';
import { KnowledgeProductService } from './knowledge-product.service';

@Module({
  imports: [KnowledgeModule, KnowledgeIndexingModule, DocumentInputModule],
  controllers: [KnowledgeProductController, KnowledgeProductIndexController],
  providers: [KnowledgeProductService, KnowledgeProductIndexingService],
  exports: [KnowledgeProductService],
})
export class KnowledgeProductModule {}
