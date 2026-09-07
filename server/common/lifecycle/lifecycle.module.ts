import { Global, Module } from '@nestjs/common';

import { ApplicationShutdownCoordinator } from './application-shutdown.coordinator';

@Global()
@Module({
  providers: [ApplicationShutdownCoordinator],
  exports: [ApplicationShutdownCoordinator],
})
export class LifecycleModule {}
