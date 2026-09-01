import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { PointsService } from './points.service';
import type { PointRecordListResponse, PointRecordType, MemberLevel } from '@shared/api.interface';

@Controller('api/points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * 积分流水列表（分页）
   */
  @NeedLogin()
  @Get('records')
  async getRecords(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ): Promise<PointRecordListResponse> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    const recordType = type ? (type as PointRecordType) : undefined;

    return this.pointsService.getRecords(userId, pageNum, pageSizeNum, recordType);
  }

  /**
   * 获取当前积分余额与会员等级
   */
  @NeedLogin()
  @Get('balance')
  async getBalance(@Req() req: Request): Promise<{ points: number; memberLevel: MemberLevel }> {
    const { userId } = req.userContext;
    return this.pointsService.getBalance(userId);
  }
}
