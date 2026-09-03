import 'dotenv/config';

import axios from 'axios';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { DeepSeekProvider } from '../server/modules/ai-tools/llm/deepseek.provider';
import { LlmService } from '../server/modules/ai-tools/llm/llm.service';
import { TEXT_GENERATION_PROVIDER } from '../server/modules/ai-tools/llm/text-generation.provider';

@Controller('api/ai-tools')
class HealthController {
  constructor(private readonly llmService: LlmService) {}

  @Get('llm/health')
  getLlmHealth() {
    return this.llmService.checkHealth();
  }
}

@Module({
  controllers: [HealthController],
  providers: [
    { provide: TEXT_GENERATION_PROVIDER, useClass: DeepSeekProvider },
    LlmService,
  ],
})
class HealthCheckModule {}

async function main(): Promise<void> {
  const app = await NestFactory.create(HealthCheckModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  try {
    const response = await axios.get(`${await app.getUrl()}/api/ai-tools/llm/health`);
    console.log(JSON.stringify(response.data, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'DeepSeek health check failed');
  process.exitCode = 1;
});
