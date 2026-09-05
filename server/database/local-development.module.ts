import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { DRIZZLE_DATABASE } from './database.types';
import {
  createLocalDevelopmentDatabase,
  type LocalDevelopmentDatabase,
} from './local-development.database';

export const LOCAL_DEVELOPMENT_DATABASE = Symbol('LOCAL_DEVELOPMENT_DATABASE');

class LocalDevelopmentDatabaseLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(LOCAL_DEVELOPMENT_DATABASE)
    private readonly localDatabase: LocalDevelopmentDatabase,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.localDatabase.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: LOCAL_DEVELOPMENT_DATABASE,
      useFactory: () => createLocalDevelopmentDatabase(),
    },
    {
      provide: DRIZZLE_DATABASE,
      useFactory: (localDatabase: LocalDevelopmentDatabase) => localDatabase.db,
      inject: [LOCAL_DEVELOPMENT_DATABASE],
    },
    {
      provide: LocalDevelopmentDatabaseLifecycle,
      useFactory: (localDatabase: LocalDevelopmentDatabase) =>
        new LocalDevelopmentDatabaseLifecycle(localDatabase),
      inject: [LOCAL_DEVELOPMENT_DATABASE],
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class LocalDevelopmentDatabaseModule {}
