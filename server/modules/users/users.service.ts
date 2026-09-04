import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import { eq } from 'drizzle-orm';
import { appUsers } from '@server/database/schema';
import type { UserProfile, MemberLevel } from '@shared/api.interface';
import { MEMBER_LEVELS } from '@shared/api.interface';

type AppUserRow = typeof appUsers.$inferSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase) {}

  /**
   * 根据累计充值金额计算会员等级
   */
  calculateMemberLevel(totalRecharge: number): MemberLevel {
    let level: MemberLevel = 'normal';
    for (const lvl of MEMBER_LEVELS) {
      if (totalRecharge >= lvl.threshold) {
        level = lvl.level;
      } else {
        break;
      }
    }
    return level;
  }

  /**
   * 将数据库行转换为 UserProfile 接口返回
   */
  private toUserProfile(row: AppUserRow): UserProfile {
    return {
      userId: row.userId,
      username: row.username ?? undefined,
      phone: row.phone ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      points: row.points,
      totalRecharge: row.totalRecharge,
      memberLevel: row.memberLevel as MemberLevel,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * 确保用户存在，不存在则创建默认记录
   */
  async ensureUser(userId: string): Promise<UserProfile> {
    const existing: AppUserRow[] = await this.db
      .select()
      .from(appUsers)
      .where(eq(appUsers.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return this.toUserProfile(existing[0]);
    }

    const created: AppUserRow[] = await this.db
      .insert(appUsers)
      .values({
        userId,
        points: 0,
        totalRecharge: 0,
        memberLevel: 'normal',
      })
      .returning();

    this.logger.log(`创建新用户记录: ${userId}`);
    return this.toUserProfile(created[0]);
  }

  /**
   * 获取用户信息（不存在则创建）
   */
  async getProfile(userId: string): Promise<UserProfile> {
    return this.ensureUser(userId);
  }

  /**
   * 更新用户信息
   */
  async updateProfile(
    userId: string,
    patch: { username?: string; avatarUrl?: string; phone?: string },
  ): Promise<UserProfile> {
    const updateData: Partial<typeof appUsers.$inferInsert> = {};
    if (patch.username !== undefined) updateData.username = patch.username;
    if (patch.avatarUrl !== undefined) updateData.avatarUrl = patch.avatarUrl;
    if (patch.phone !== undefined) updateData.phone = patch.phone;

    if (Object.keys(updateData).length === 0) {
      // 无更新字段，直接返回当前记录
      return this.ensureUser(userId);
    }

    updateData.updatedAt = new Date();

    const updated: AppUserRow[] = await this.db
      .update(appUsers)
      .set(updateData)
      .where(eq(appUsers.userId, userId))
      .returning();

    if (updated.length === 0) {
      // 用户不存在，先创建再更新
      await this.ensureUser(userId);
      const reUpdated: AppUserRow[] = await this.db
        .update(appUsers)
        .set(updateData)
        .where(eq(appUsers.userId, userId))
        .returning();
      return this.toUserProfile(reUpdated[0]);
    }

    return this.toUserProfile(updated[0]);
  }
}
