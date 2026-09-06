import { Module } from '@nestjs/common';
import { DocumentInputModule } from '../document-input/document-input.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ZoteroAttachmentService } from './zotero-attachment.service';
import { ZoteroClient } from './zotero.client';
import { ZoteroConnectionRepository } from './zotero-connection.repository';
import { ZoteroCredentialIntrospectionClient } from './zotero-credential-introspection.client';
import { ZoteroCredentialResolver } from './zotero-credential-resolver';
import { ZoteroImportService } from './zotero-import.service';
import {
  EnvironmentZoteroCredentialCrypto,
  resolveZoteroConfig,
  ZOTERO_CONFIG,
  ZOTERO_CRYPTO,
} from './zotero.config';
import { ZoteroController } from './zotero.controller';
import { ZoteroSourceService } from './zotero-source.service';

@Module({
  imports: [DocumentInputModule, KnowledgeModule],
  controllers: [ZoteroController],
  providers: [
    {
      provide: ZOTERO_CONFIG,
      useFactory: () => resolveZoteroConfig(),
      inject: [],
    },
    {
      provide: ZoteroCredentialIntrospectionClient,
      useFactory: (config: ReturnType<typeof resolveZoteroConfig>) =>
        new ZoteroCredentialIntrospectionClient(config),
      inject: [ZOTERO_CONFIG],
    },
    {
      provide: ZoteroClient,
      useFactory: (config: ReturnType<typeof resolveZoteroConfig>) => new ZoteroClient(config),
      inject: [ZOTERO_CONFIG],
    },
    {
      provide: ZOTERO_CRYPTO,
      useFactory: () => new EnvironmentZoteroCredentialCrypto(),
      inject: [],
    },
    {
      provide: ZoteroCredentialResolver,
      useFactory: (
        introspection: ZoteroCredentialIntrospectionClient,
        crypto: EnvironmentZoteroCredentialCrypto,
        repository: ZoteroConnectionRepository,
        client: ZoteroClient,
      ) => new ZoteroCredentialResolver(introspection, crypto, repository, client),
      inject: [ZoteroCredentialIntrospectionClient, ZOTERO_CRYPTO, ZoteroConnectionRepository, ZoteroClient],
    },
    ZoteroConnectionRepository,
    ZoteroSourceService,
    ZoteroAttachmentService,
    ZoteroImportService,
  ],
  exports: [ZoteroImportService],
})
export class ZoteroModule {}
