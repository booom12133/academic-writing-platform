import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { OrdersService } from './orders.service';
import type {
  RechargeOrder,
  OrderListResponse,
  CreateOrderRequest,
} from '@shared/api.interface';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @NeedLogin()
  @Post()
  async createOrder(
    @Req() req: Request,
    @Body() dto: CreateOrderRequest,
  ): Promise<{ order: RechargeOrder; qrCodeUrl: string }> {
    const { userId } = req.userContext;
    return this.ordersService.createOrder(userId, dto.amount, dto.payMethod);
  }

  @NeedLogin()
  @Get()
  async getOrderList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ): Promise<OrderListResponse> {
    const { userId } = req.userContext;
    const pageNum: number = page ? parseInt(page, 10) : 1;
    const pageSizeNum: number = pageSize ? parseInt(pageSize, 10) : 10;
    return this.ordersService.getOrderList(userId, pageNum, pageSizeNum, status);
  }

  @NeedLogin()
  @Get(':id')
  async getOrderDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<RechargeOrder> {
    const { userId } = req.userContext;
    return this.ordersService.getOrderDetail(userId, id);
  }

  @NeedLogin()
  @Post(':id/pay')
  async payOrder(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<RechargeOrder> {
    const { userId } = req.userContext;
    return this.ordersService.payOrder(userId, id);
  }

  @NeedLogin()
  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<RechargeOrder> {
    const { userId } = req.userContext;
    return this.ordersService.cancelOrder(userId, id);
  }
}
