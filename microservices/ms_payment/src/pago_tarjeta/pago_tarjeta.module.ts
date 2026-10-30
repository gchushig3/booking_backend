import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from '../pago/pago.entity.js';
import { PagoTarjetaService } from './pago_tarjeta.service.js';
import { PagoTarjetaController } from './pago_tarjeta.controller.js';
import { PagoTarjeta } from './pago_tarjeta.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([PagoTarjeta, Pago])],
  controllers: [PagoTarjetaController],
  providers: [PagoTarjetaService],
})
export class PagoTarjetaModule {}
