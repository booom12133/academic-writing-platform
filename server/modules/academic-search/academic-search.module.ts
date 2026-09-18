import { Module } from '@nestjs/common';
import { ACADEMIC_SEARCH_CONFIG, resolveAcademicSearchConfig } from './academic-search.config';
import { HmacAcademicSearchCursorCodec } from './academic-search.cursor';
import { AcademicSearchController } from './academic-search.controller';
import { ACADEMIC_SEARCH_PROVIDER, type AcademicSearchProvider } from './academic-search.provider';
import { AcademicSearchService } from './academic-search.service';
import { OpenAlexClient } from './openalex.client';
import { OpenAlexProvider } from './openalex.provider';
import { OpenAlexImportGateway } from './openalex-import.gateway';

@Module({
  controllers: [AcademicSearchController],
  providers: [
    {
      provide: ACADEMIC_SEARCH_CONFIG,
      useFactory: () => resolveAcademicSearchConfig(),
      inject: [],
    },
    {
      provide: HmacAcademicSearchCursorCodec,
      useFactory: (config: ReturnType<typeof resolveAcademicSearchConfig>) => new HmacAcademicSearchCursorCodec({ secret: config.cursorSecret, ttlMs: config.cursorTtlMs }),
      inject: [ACADEMIC_SEARCH_CONFIG],
    },
    {
      provide: OpenAlexClient,
      useFactory: (config: ReturnType<typeof resolveAcademicSearchConfig>) => new OpenAlexClient(config),
      inject: [ACADEMIC_SEARCH_CONFIG],
    },
    {
      provide: OpenAlexProvider,
      useFactory: (client: OpenAlexClient, cursorCodec: HmacAcademicSearchCursorCodec) => new OpenAlexProvider(client, cursorCodec),
      inject: [OpenAlexClient, HmacAcademicSearchCursorCodec],
    },
    {
      provide: ACADEMIC_SEARCH_PROVIDER,
      useExisting: OpenAlexProvider,
    },
    {
      provide: OpenAlexImportGateway,
      useFactory: (client: OpenAlexClient) => new OpenAlexImportGateway(client),
      inject: [OpenAlexClient],
    },
    {
      provide: AcademicSearchService,
      useFactory: (provider: AcademicSearchProvider, cursorCodec: HmacAcademicSearchCursorCodec, config: ReturnType<typeof resolveAcademicSearchConfig>) => new AcademicSearchService(provider, cursorCodec, config),
      inject: [ACADEMIC_SEARCH_PROVIDER, HmacAcademicSearchCursorCodec, ACADEMIC_SEARCH_CONFIG],
    },
  ],
  exports: [ACADEMIC_SEARCH_PROVIDER, AcademicSearchService, OpenAlexImportGateway],
})
export class AcademicSearchModule {}
