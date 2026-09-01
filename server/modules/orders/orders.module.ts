import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PointsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
