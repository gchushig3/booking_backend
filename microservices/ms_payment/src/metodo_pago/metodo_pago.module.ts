import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetodoPagoService } from './metodo_pago.service.js';
import { MetodoPagoController } from './metodo_pago.controller.js';
import { MetodoPago } from './metodo_pago.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([MetodoPago])],
  controllers: [MetodoPagoController],
  providers: [MetodoPagoService],
})
export class MetodoPagoModule {}
