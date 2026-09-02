const { NestFactory } = require('@nestjs/core');

process.env.NODE_ENV = 'development';
process.env.MIAODA_LOCAL_DEV = '1';
process.env.DOCUMENT_STORAGE_DRIVER = 'filesystem';
process.env.DOCUMENT_STORAGE_ROOT =
  'D:\\CodexGlobal\\academic-writing-platform-d1-bootstrap-storage';

const { AppModule } = require('../dist/server/app.module.js');
const {
  AiToolsModule,
} = require('../dist/server/modules/ai-tools/ai-tools.module.js');
const {
  AcademicToolExecutionService,
} = require('../dist/server/modules/ai-tools/execution/academic-tool-execution.service.js');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: true,
  });
  try {
    app.select(AiToolsModule).get(AcademicToolExecutionService);
  } finally {
    await app.close();
  }
  console.log(
    'AppModule bootstrap PASS: AiToolsModule execution foundation resolved.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
