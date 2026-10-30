import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagoService } from './pago.service.js';
import { PagoController } from './pago.controller.js';
import { Pago } from './pago.entity.js';
import { MetodoPago } from '../metodo_pago/metodo_pago.entity.js';
import { Estado } from '../estado/estado.entity.js';
import { PagoTarjeta } from '../pago_tarjeta/pago_tarjeta.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Pago, MetodoPago, Estado, PagoTarjeta])],
  controllers: [PagoController],
  providers: [PagoService],
})
export class PagoModule {}
