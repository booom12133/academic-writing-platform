import { Module } from '@nestjs/common';
import { PaperProjectController } from './paper-project.controller';
import { PaperProjectRepository } from './paper-project.repository';
import { PaperProjectService } from './paper-project.service';
import { AiToolsModule } from '../ai-tools/ai-tools.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { KnowledgeProductModule } from '../knowledge-product/knowledge-product.module';
import { GroundedGenerationModule } from '../grounded-generation/grounded-generation.module';
import { PaperWorkflowController } from './paper-workflow.controller';
import { PaperWorkflowService } from './paper-workflow.service';
import { PaperSourceService } from './paper-source.service';
import { PaperGenerationService } from './paper-generation.service';
import { PaperPlanningService } from './paper-planning.service';
import { ResearchPlanGenerator } from './generators/research-plan.generator';
import { PaperOutlineGenerator } from './generators/paper-outline.generator';
import { PaperSectionModelGenerator } from './generators/paper-section-model.generator';
import { AcademicIntegrityValidator } from './generators/academic-integrity.validator';
import { PaperWritingContextBuilder } from './paper-writing-context.builder';
import { KnowledgeIndexingModule } from '../knowledge/indexing/knowledge-indexing.module';
import { ManuscriptController } from './manuscript/manuscript.controller';
import { ManuscriptProjectionService } from './manuscript/manuscript-projection.service';
import { DerivedContentService } from './manuscript/derived-content.service';
import { StorageModule } from '../storage/storage.module';
import { PaperExportController } from './export/paper-export.controller';
import { PaperExportRepository } from './export/paper-export.repository';
import { PaperExportService } from './export/paper-export.service';

@Module({ imports:[AiToolsModule,KnowledgeModule,KnowledgeProductModule,KnowledgeIndexingModule,GroundedGenerationModule,StorageModule],controllers: [PaperProjectController,PaperWorkflowController,ManuscriptController,PaperExportController], providers: [PaperProjectRepository, PaperProjectService,PaperWorkflowService,PaperSourceService,PaperGenerationService,PaperPlanningService,ResearchPlanGenerator,PaperOutlineGenerator,PaperSectionModelGenerator,AcademicIntegrityValidator,PaperWritingContextBuilder,ManuscriptProjectionService,DerivedContentService,PaperExportRepository,PaperExportService], exports: [PaperProjectRepository, PaperProjectService,ManuscriptProjectionService,PaperExportService] })
export class PaperProjectModule {}
