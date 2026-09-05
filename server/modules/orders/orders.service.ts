import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type AppDatabase } from '../../database/database.types';
import { rechargeOrders } from '@server/database/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import type { RechargeOrder, OrderStatus } from '@shared/api.interface';
import { PointsService } from '../points/points.service';

function toOrderResponse(row: typeof rechargeOrders.$inferSelect): RechargeOrder {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    points: row.points,
    status: row.status as OrderStatus,
    payMethod: row.payMethod ?? undefined,
    payOrderNo: row.payOrderNo ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function generatePayOrderNo(): string {
  const ts: string = Date.now().toString();
  const rand: string = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `RC${ts}${rand}`;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: AppDatabase,
    private readonly pointsService: PointsService,
  ) {}

  async createOrder(
    userId: string,
    amount: number,
    payMethod: string,
  ): Promise<{ order: RechargeOrder; qrCodeUrl: string }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('充值金额必须是正整数');
    }
    if (payMethod !== 'alipay' && payMethod !== 'wechat') {
      throw new BadRequestException('支付方式仅支持 alipay 或 wechat');
    }

    const points: number = amount;
    const payOrderNo: string = generatePayOrderNo();

    const inserted = await this.db
      .insert(rechargeOrders)
      .values({
        userId,
        amount,
        points,
        status: 'pending',
        payMethod,
        payOrderNo,
      })
      .returning();

    if (inserted.length === 0) {
      throw new BadRequestException('创建订单失败');
    }

    const order: RechargeOrder = toOrderResponse(inserted[0]);
    const qrCodeUrl: string = `https://picsum.photos/seed/qr${order.id}/200/200`;

    return { order, qrCodeUrl };
  }

  async getOrderList(
    userId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<{ items: RechargeOrder[]; total: number; page: number; pageSize: number }> {
    const conditions = [eq(rechargeOrders.userId, userId)];
    if (status) {
      conditions.push(eq(rechargeOrders.status, status));
    }

    const whereClause = and(...conditions);
    const offset: number = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(rechargeOrders)
        .where(whereClause)
        .orderBy(desc(rechargeOrders.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(rechargeOrders)
        .where(whereClause),
    ]);

    const total: number = Number(countResult[0]?.count ?? 0);
    const items: RechargeOrder[] = rows.map((row: typeof rechargeOrders.$inferSelect) =>
      toOrderResponse(row),
    );

    return { items, total, page, pageSize };
  }

  async getOrderDetail(userId: string, orderId: string): Promise<RechargeOrder> {
    const rows = await this.db
      .select()
      .from(rechargeOrders)
      .where(eq(rechargeOrders.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const row = rows[0];
    if (row.userId !== userId) {
      throw new ForbiddenException('无权访问该订单');
    }

    return toOrderResponse(row);
  }

  async payOrder(userId: string, orderId: string): Promise<RechargeOrder> {
    const rows = await this.db
      .select()
      .from(rechargeOrders)
      .where(eq(rechargeOrders.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const row = rows[0];
    if (row.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (row.status !== 'pending') {
      throw new ConflictException('订单状态不允许支付');
    }

    const updated = await this.db
      .update(rechargeOrders)
      .set({ status: 'paid' })
      .where(
        and(
          eq(rechargeOrders.id, orderId),
          eq(rechargeOrders.status, 'pending'),
        ),
      )
      .returning();

    if (updated.length === 0) {
      throw new ConflictException('订单状态已变更，支付失败');
    }

    await this.pointsService.recharge({
      userId,
      points: row.points,
      orderId,
      description: '充值订单',
    });

    return toOrderResponse(updated[0]);
  }

  async cancelOrder(userId: string, orderId: string): Promise<RechargeOrder> {
    const rows = await this.db
      .select()
      .from(rechargeOrders)
      .where(eq(rechargeOrders.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('订单不存在');
    }

    const row = rows[0];
    if (row.userId !== userId) {
      throw new ForbiddenException('无权操作该订单');
    }
    if (row.status !== 'pending') {
      throw new ConflictException('订单状态不允许取消');
    }

    const updated = await this.db
      .update(rechargeOrders)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(rechargeOrders.id, orderId),
          eq(rechargeOrders.status, 'pending'),
        ),
      )
      .returning();

    if (updated.length === 0) {
      throw new ConflictException('订单状态已变更，取消失败');
    }

    return toOrderResponse(updated[0]);
  }
}
