import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SagaBus } from '@booking/infrastructure';
import { Refund } from './refund.entity.js';
import { RefundController } from './refund.controller.js';
import { RefundEventsController } from './refund-events.controller.js';
import { RefundService } from './refund.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Refund])],
  controllers: [RefundController, RefundEventsController],
  providers: [RefundService, SagaBus],
})
export class RefundModule {}
