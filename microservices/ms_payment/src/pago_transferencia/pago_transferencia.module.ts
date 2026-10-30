import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from '../pago/pago.entity.js';
import { PagoTransferenciaService } from './pago_transferencia.service.js';
import { PagoTransferenciaController } from './pago_transferencia.controller.js';
import { PagoTransferencia } from './pago_transferencia.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([PagoTransferencia, Pago])],
  controllers: [PagoTransferenciaController],
  providers: [PagoTransferenciaService],
})
export class PagoTransferenciaModule {}
