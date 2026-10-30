import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mensaje } from './mensaje.entity.js';
import { MensajesController } from './mensaje.controller.js';
import { MensajeService } from './mensaje.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Mensaje])],
  controllers: [MensajesController],
  providers: [MensajeService],
  exports: [TypeOrmModule],
})
export class MensajeModule {}
