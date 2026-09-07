import { Body, Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { GroundedGenerationExceptionFilter } from './grounded-generation.exception-filter';
import { GroundedGenerationService } from './grounded-generation.service';
import type { GroundedGenerationRequest } from './grounded-generation.types';

@Controller('api/grounded-generation')
@UseFilters(GroundedGenerationExceptionFilter)
export class GroundedGenerationController {
  constructor(private readonly service: GroundedGenerationService) {}

  @NeedLogin()
  @HttpCode(HttpStatus.OK)
  @Post('generate')
  async generate(@Req() req: Request, @Body() body: GroundedGenerationRequest) {
    const userId = req.userContext?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return this.service.generate(userId, body);
  }
}
