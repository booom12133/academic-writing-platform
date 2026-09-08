import { Module } from '@nestjs/common';

import { DocumentInputModule } from '../document-input/document-input.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeProductController } from './knowledge-product.controller';
import { KnowledgeProductService } from './knowledge-product.service';

@Module({
  imports: [KnowledgeModule, DocumentInputModule],
  controllers: [KnowledgeProductController],
  providers: [KnowledgeProductService],
  exports: [KnowledgeProductService],
})
export class KnowledgeProductModule {}
