import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { UsersService } from './users.service';
import type { UserProfile } from '@shared/api.interface';

interface UpdateProfileBody {
  username?: string;
  avatarUrl?: string;
  phone?: string;
}

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @NeedLogin()
  @Get('profile')
  async getProfile(@Req() req: Request): Promise<UserProfile> {
    const { userId } = req.userContext;
    return this.usersService.getProfile(userId);
  }

  @NeedLogin()
  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() body: UpdateProfileBody,
  ): Promise<UserProfile> {
    const { userId } = req.userContext;
    return this.usersService.updateProfile(userId, body);
  }

  @NeedLogin()
  @Post('ensure')
  async ensureUser(@Req() req: Request): Promise<UserProfile> {
    const { userId } = req.userContext;
    return this.usersService.ensureUser(userId);
  }
}
