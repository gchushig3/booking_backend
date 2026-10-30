import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfirmedEventPublisher } from '@booking/infrastructure';
import { Resena } from './resena.entity.js';
import { ResenaController } from './resena.controller.js';
import { ResenaService } from './resena.service.js';
import { ReviewOutbox } from './review-outbox.js';

@Module({
  imports: [TypeOrmModule.forFeature([Resena])],
  controllers: [ResenaController],
  providers: [ResenaService, ReviewOutbox, ConfirmedEventPublisher],
})
export class ResenaModule {}
