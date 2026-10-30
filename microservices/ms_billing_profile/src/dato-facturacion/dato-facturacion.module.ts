import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatoFacturacion } from './dato-facturacion.entity.js';
import { DatoFacturacionController } from './dato-facturacion.controller.js';
import { DatoFacturacionService } from './dato-facturacion.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DatoFacturacion])],
  controllers: [DatoFacturacionController],
  providers: [DatoFacturacionService],
  exports: [TypeOrmModule],
})
export class DatoFacturacionModule {}
