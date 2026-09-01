import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { AiToolsService } from './ai-tools.service';
import { LlmService } from './llm/llm.service';
import type { Task, ToolConfig, CreateTaskRequest } from '@shared/api.interface';

@Controller('api/ai-tools')
export class AiToolsController {
  constructor(
    private readonly aiToolsService: AiToolsService,
    private readonly llmService: LlmService,
  ) {}

  @NeedLogin()
  @Post('submit')
  async submit(@Req() req: Request, @Body() body: CreateTaskRequest): Promise<Task> {
    const { userId } = req.userContext;
    return this.aiToolsService.submitTask({
      userId,
      taskType: body.taskType,
      title: body.title,
      inputData: body.inputData,
    });
  }

  @Get('tools')
  async getTools(): Promise<ToolConfig[]> {
    return this.aiToolsService.getToolConfigs();
  }

  @Get('llm/health')
  async getLlmHealth() {
    return this.llmService.checkHealth();
  }
}
