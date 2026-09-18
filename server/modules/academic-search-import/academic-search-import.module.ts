import { Module } from '@nestjs/common';
import { AcademicSearchModule } from '../academic-search/academic-search.module';
import { DocumentInputModule } from '../document-input/document-input.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeProductModule } from '../knowledge-product/knowledge-product.module';
import { AcademicSearchImportController } from './academic-search-import.controller';
import { AcademicSearchImportService } from './academic-search-import.service';

@Module({
  imports: [AcademicSearchModule, DocumentInputModule, KnowledgeModule, KnowledgeProductModule],
  controllers: [AcademicSearchImportController],
  providers: [AcademicSearchImportService],
})
export class AcademicSearchImportModule {}
