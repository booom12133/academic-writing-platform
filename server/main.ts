import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { configureApp } from '@lark-apaas/fullstack-nestjs-core';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadRuntimeConfig } from './config/production-config';
import { applyProxyTrust } from './common/security/proxy-trust';

const runtimeConfig = loadRuntimeConfig();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });
  await configureApp(app, {
    disableSwagger: true,
    bodyLimit: runtimeConfig.security.bodySizeLimit,
  });
  applyProxyTrust(app, runtimeConfig.security.trustProxyHops);
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
  app.enableCors({
    origin:
      runtimeConfig.profile === 'local'
        ? true
        : runtimeConfig.security.corsAllowedOrigins.length > 0
          ? [...runtimeConfig.security.corsAllowedOrigins]
          : false,
  });
  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3000');

  // 生产前端根同时承载构建后的 HTML 与 hashed 静态资源。
  // index=false 保留 ViewController 对入口页的平台上下文渲染。
  const frontendRoot = join(process.cwd(), 'dist/client');
  app.useStaticAssets(frontendRoot, { index: false });
  app.setBaseViewsDir(frontendRoot);
  app.setViewEngine('html');
  app.engine('html', hbsExpressEngine);

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
