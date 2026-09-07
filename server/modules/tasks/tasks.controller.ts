import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { TasksService } from './tasks.service';
import { validateTaskStatusPatch } from './tasks-status.validation';
import type {
  Task,
  TaskListResponse,
  CreateTaskRequest,
} from '@shared/api.interface';

@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @NeedLogin()
  @Post()
  async create(
    @Req() req: Request,
    @Body() body: CreateTaskRequest,
  ): Promise<Task> {
    const { userId } = req.userContext;
    return this.tasksService.createTask({
      userId,
      taskType: body.taskType,
      title: body.title,
      inputData: body.inputData,
    });
  }

  @NeedLogin()
  @Get()
  async list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('taskType') taskType?: string,
  ): Promise<TaskListResponse> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const result = await this.tasksService.listUserTasks({
      userId,
      page: pageNum,
      pageSize: pageSizeNum,
      taskType: taskType as Task['taskType'] | undefined,
      status: status as Task['status'] | undefined,
    });
    return { ...result, page: pageNum, pageSize: pageSizeNum };
  }

  @NeedLogin()
  @Get('stats/count')
  async getStatsCount(@Req() req: Request): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const { userId } = req.userContext;
    return this.tasksService.getStatsByUser(userId);
  }

  @NeedLogin()
  @Get(':id')
  async getById(@Req() req: Request, @Param('id') id: string): Promise<Task> {
    const { userId } = req.userContext;
    return this.tasksService.getTaskByIdWithOwner(id, userId);
  }

  @NeedLogin()
  @Patch(':id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Task> {
    const { userId } = req.userContext;
    const updated = await this.tasksService.updateTask(id, userId, validateTaskStatusPatch(body));
    if (!updated) {
      throw new Error('任务不存在');
    }
    return updated;
  }

  @NeedLogin()
  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    const { userId } = req.userContext;
    await this.tasksService.deleteTask(id, userId);
    return { success: true };
  }
}
