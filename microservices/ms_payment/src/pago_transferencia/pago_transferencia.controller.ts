import { InfrastructureRoles } from '@booking/infrastructure';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BigIntIdPipe } from '../common/pipes/bigint-id.pipe.js';
import { CrearDetalleTransferenciaRequestDto } from './dto/crear-detalle-transferencia-request.dto.js';
import { DetalleTransferenciaResponseDto } from './dto/detalle-transferencia-response.dto.js';
import { PagoTransferenciaService } from './pago_transferencia.service.js';

@InfrastructureRoles('ADMIN')
@Controller('pagos/:id/transferencia')
export class PagoTransferenciaController {
  constructor(
    private readonly pagoTransferenciaService: PagoTransferenciaService,
  ) {}

  @Post()
  crear(
    @Param('id', BigIntIdPipe) id: string,
    @Body() request: CrearDetalleTransferenciaRequestDto,
  ): Promise<DetalleTransferenciaResponseDto> {
    return this.pagoTransferenciaService.crear(id, request);
  }

  @Get()
  obtener(
    @Param('id', BigIntIdPipe) id: string,
  ): Promise<DetalleTransferenciaResponseDto> {
    return this.pagoTransferenciaService.obtener(id);
  }
}
