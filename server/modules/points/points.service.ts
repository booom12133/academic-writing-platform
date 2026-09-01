import { Injectable, Inject, Logger, ConflictException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, count } from 'drizzle-orm';
import { pointRecords, appUsers } from '@server/database/schema';
import type { PointRecord, PointRecordListResponse, PointRecordType, MemberLevel } from '@shared/api.interface';
import { MEMBER_LEVELS } from '@shared/api.interface';

interface RechargeOptions {
  userId: string;
  points: number;
  orderId?: string;
  description?: string;
}

interface ConsumeOptions {
  userId: string;
  points: number;
  taskId?: string;
  description?: string;
}

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 计算会员折扣后的实际消耗积分
   * 向下取整，最低 1 积分
   */
  calculateActualCost(basePoints: number, memberLevel: MemberLevel): number {
    const levelInfo = MEMBER_LEVELS.find((l) => l.level === memberLevel);
    const discount = levelInfo?.discount ?? 1;
    const actual = Math.floor(basePoints * discount);
    return Math.max(1, actual);
  }

  /**
   * 根据累计充值金额计算会员等级
   */
  private computeMemberLevel(totalRecharge: number): MemberLevel {
    let level: MemberLevel = 'normal';
    for (const l of MEMBER_LEVELS) {
      if (totalRecharge >= l.threshold) {
        level = l.level;
      }
    }
    return level;
  }

  /**
   * 获取用户积分流水列表（分页）
   */
  async getRecords(
    userId: string,
    page: number,
    pageSize: number,
    type?: PointRecordType,
  ): Promise<PointRecordListResponse> {
    const whereConditions = [eq(pointRecords.userId, userId)];
    if (type) {
      whereConditions.push(eq(pointRecords.type, type));
    }
    const whereClause = and(...whereConditions);

    const [countResult, records] = await Promise.all([
      this.db.select({ count: count() }).from(pointRecords).where(whereClause),
      this.db
        .select()
        .from(pointRecords)
        .where(whereClause)
        .orderBy(desc(pointRecords.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: PointRecord[] = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type as PointRecordType,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      taskId: r.taskId ?? undefined,
      orderId: r.orderId ?? undefined,
      description: r.description ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
  }

  /**
   * 获取用户当前积分余额与会员等级
   */
  async getBalance(userId: string): Promise<{ points: number; memberLevel: MemberLevel }> {
    const user = await this.db
      .select({ points: appUsers.points, memberLevel: appUsers.memberLevel })
      .from(appUsers)
      .where(eq(appUsers.userId, userId))
      .limit(1);

    if (user.length === 0) {
      return { points: 0, memberLevel: 'normal' };
    }

    return {
      points: user[0].points,
      memberLevel: user[0].memberLevel as MemberLevel,
    };
  }

  /**
   * 充值积分（事务：更新余额 + 插入流水 + 更新累计充值与会员等级）
   */
  async recharge(options: RechargeOptions): Promise<{ points: number; memberLevel: MemberLevel }> {
    const { userId, points, orderId, description } = options;

    if (points <= 0) {
      throw new ConflictException('充值积分必须大于 0');
    }

    const result = await this.db.transaction(async (tx) => {
      // 1. 查询当前用户
      const existing = await tx
        .select({ id: appUsers.id, points: appUsers.points, totalRecharge: appUsers.totalRecharge })
        .from(appUsers)
        .where(eq(appUsers.userId, userId))
        .limit(1);

      let newPoints: number;
      let newTotalRecharge: number;
      let newMemberLevel: MemberLevel;

      if (existing.length === 0) {
        // 用户不存在，创建记录
        newPoints = points;
        newTotalRecharge = points;
        newMemberLevel = this.computeMemberLevel(newTotalRecharge);
        await tx.insert(appUsers).values({
          userId,
          points: newPoints,
          totalRecharge: newTotalRecharge,
          memberLevel: newMemberLevel,
        });
      } else {
        newPoints = existing[0].points + points;
        newTotalRecharge = existing[0].totalRecharge + points;
        newMemberLevel = this.computeMemberLevel(newTotalRecharge);
        await tx
          .update(appUsers)
          .set({
            points: newPoints,
            totalRecharge: newTotalRecharge,
            memberLevel: newMemberLevel,
          })
          .where(eq(appUsers.userId, userId));
      }

      // 2. 插入流水记录
      await tx.insert(pointRecords).values({
        userId,
        type: 'recharge',
        amount: points,
        balanceAfter: newPoints,
        orderId,
        description: description ?? '积分充值',
      });

      return { points: newPoints, memberLevel: newMemberLevel };
    });

    this.logger.log(`用户 ${userId} 充值 ${points} 积分成功，当前余额 ${result.points}`);
    return result;
  }

  /**
   * 消耗积分（事务：校验余额 + 扣减 + 插入流水）
   */
  async consume(options: ConsumeOptions): Promise<{ points: number; memberLevel: MemberLevel }> {
    const { userId, points, taskId, description } = options;

    if (points <= 0) {
      throw new ConflictException('消耗积分必须大于 0');
    }

    const result = await this.db.transaction(async (tx) => {
      // 1. 查询当前用户并加锁（FOR UPDATE 通过 select...for 语法）
      const user = await tx
        .select({
          id: appUsers.id,
          points: appUsers.points,
          memberLevel: appUsers.memberLevel,
        })
        .from(appUsers)
        .where(eq(appUsers.userId, userId))
        .limit(1)
        .for('update');

      if (user.length === 0) {
        throw new ConflictException('积分不足，请先充值');
      }

      const currentPoints = user[0].points;
      if (currentPoints < points) {
        throw new ConflictException('积分不足，请先充值');
      }

      const newPoints = currentPoints - points;

      // 2. 扣减余额
      await tx
        .update(appUsers)
        .set({ points: newPoints })
        .where(eq(appUsers.userId, userId));

      // 3. 插入流水记录
      await tx.insert(pointRecords).values({
        userId,
        type: 'consume',
        amount: points,
        balanceAfter: newPoints,
        taskId,
        description: description ?? '积分消耗',
      });

      return { points: newPoints, memberLevel: user[0].memberLevel as MemberLevel };
    });

    this.logger.log(`用户 ${userId} 消耗 ${points} 积分成功，当前余额 ${result.points}`);
    return result;
  }
}
