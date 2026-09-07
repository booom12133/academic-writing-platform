import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import { tasks, pointRecords, appUsers } from '@server/database/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { Task, TaskType, TaskStatus } from '@shared/api.interface';
import { TOOL_CONFIGS } from '@shared/api.interface';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase) {}

  /**
   * 创建任务并扣除积分。
   * 积分不足时抛出 BadRequestException。
   */
  async createTask(params: {
    userId: string;
    taskType: TaskType;
    title: string;
    inputData: Record<string, any>;
  }): Promise<Task> {
    const { userId, taskType, title, inputData } = params;
    return this.createTaskWithPoints({
      userId,
      taskType,
      title,
      inputData,
      pointsCost: this.calculatePoints(taskType, inputData),
    });
  }

  async createPreparedPolishTask(params: {
    userId: string;
    title: string;
    inputData: Record<string, any>;
    preparedBillingText: string;
  }): Promise<Task> {
    const charCount = params.preparedBillingText.length;
    const pointsCost = Math.max(10, Math.ceil(charCount / 500) * 10);
    return this.createTaskWithPoints({
      userId: params.userId,
      taskType: 'polish',
      title: params.title,
      inputData: params.inputData,
      pointsCost,
    });
  }

  /**
   * 更新任务状态/进度/结果/错误信息。
   * 仅更新传入的字段。
   */
  async updateTask(
    taskId: string,
    userId: string,
    patch: {
      status?: TaskStatus;
      progress?: number;
      resultData?: Record<string, any>;
      errorMessage?: string;
    },
  ): Promise<Task | null> {
    const setValues: Record<string, any> = {};
    if (patch.status !== undefined) setValues.status = patch.status;
    if (patch.progress !== undefined) setValues.progress = patch.progress;
    if (patch.resultData !== undefined) setValues.resultData = patch.resultData;
    if (patch.errorMessage !== undefined) setValues.errorMessage = patch.errorMessage;

    if (Object.keys(setValues).length === 0) {
      const found = await this.getTaskByIdWithOwner(taskId, userId);
      return found ?? null;
    }

    const updated = await this.db
      .update(tasks)
      .set(setValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (updated.length === 0) return null;
    return this.mapRowToTask(updated[0]);
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (rows.length === 0) return null;
    return this.mapRowToTask(rows[0]);
  }

  async listUserTasks(params: {
    userId: string;
    page: number;
    pageSize: number;
    taskType?: TaskType;
    status?: TaskStatus;
  }): Promise<{ items: Task[]; total: number }> {
    const { userId, page, pageSize, taskType, status } = params;
    const conditions = [eq(tasks.userId, userId)];
    if (taskType) conditions.push(eq(tasks.taskType, taskType));
    if (status) conditions.push(eq(tasks.status, status));

    const where = and(...conditions);

    const [countRows, rows] = await Promise.all([
      this.db.select({ count: count() }).from(tasks).where(where),
      this.db
        .select()
        .from(tasks)
        .where(where)
        .orderBy(desc(tasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total: number = Number(countRows[0]?.count ?? 0);
    const items: Task[] = rows.map((row) => this.mapRowToTask(row));
    return { items, total };
  }

  private calculatePoints(taskType: TaskType, inputData: Record<string, any>): number {
    const toolConfig = TOOL_CONFIGS.find((t) => t.type === taskType);
    if (!toolConfig) return 0;

    if (taskType === 'polish') {
      const content: string = (inputData.text as string) ?? '';
      const charCount = content.length;
      // 每 500 字 10 积分，不足 500 按最低 10 积分计
      const calculated = Math.max(10, Math.ceil(charCount / 500) * 10);
      return calculated;
    }

    return toolConfig.basePoints;
  }

  private async createTaskWithPoints(params: {
    userId: string;
    taskType: TaskType;
    title: string;
    inputData: Record<string, any>;
    pointsCost: number;
  }): Promise<Task> {
    const { userId, taskType, title, inputData, pointsCost } = params;
    const toolConfig = TOOL_CONFIGS.find((t) => t.type === taskType);
    if (!toolConfig) {
      throw new BadRequestException('未知的工具类型');
    }

    return this.db.transaction(async (tx) => {
      const userRows = await tx
        .select({ points: appUsers.points, memberLevel: appUsers.memberLevel })
        .from(appUsers)
        .where(eq(appUsers.userId, userId))
        .limit(1);

      if (userRows.length === 0) {
        throw new BadRequestException('用户不存在');
      }

      const currentPoints: number = userRows[0].points;
      if (currentPoints < pointsCost) {
        throw new BadRequestException('积分不足，请先充值');
      }

      const newBalance: number = currentPoints - pointsCost;
      await tx.update(appUsers).set({ points: newBalance }).where(eq(appUsers.userId, userId));

      const inserted = await tx
        .insert(tasks)
        .values({
          userId,
          taskType,
          title,
          status: 'pending',
          progress: 0,
          pointsCost,
          inputData,
        })
        .returning();

      const taskId: string = inserted[0].id;

      await tx.insert(pointRecords).values({
        userId,
        type: 'consume',
        amount: -pointsCost,
        balanceAfter: newBalance,
        taskId,
        description: `${toolConfig.name}`,
      });

      return this.mapRowToTask(inserted[0]);
    });
  }

  async getStatsByUser(userId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const all = await this.db
      .select({ status: tasks.status })
      .from(tasks)
      .where(eq(tasks.userId, userId));

    const result = {
      total: all.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    for (const row of all) {
      if (row.status === 'pending') result.pending += 1;
      else if (row.status === 'processing') result.processing += 1;
      else if (row.status === 'completed') result.completed += 1;
      else if (row.status === 'failed') result.failed += 1;
    }
    return result;
  }

  async getTaskByIdWithOwner(taskId: string, userId: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task || task.userId !== userId) {
      throw new BadRequestException('任务不存在');
    }
    return task;
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskById(taskId);
    if (!task || task.userId !== userId) {
      throw new BadRequestException('任务不存在');
    }
    await this.db.delete(tasks).where(eq(tasks.id, taskId));
  }

  private mapRowToTask(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      userId: row.userId,
      taskType: row.taskType as TaskType,
      title: row.title,
      status: row.status as TaskStatus,
      progress: row.progress,
      pointsCost: row.pointsCost,
      inputData: (row.inputData as Record<string, any>) ?? {},
      resultData: row.resultData ? (row.resultData as Record<string, any>) : undefined,
      errorMessage: row.errorMessage ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
