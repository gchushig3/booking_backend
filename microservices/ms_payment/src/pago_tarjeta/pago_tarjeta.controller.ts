import { InfrastructureRoles } from '@booking/infrastructure';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BigIntIdPipe } from '../common/pipes/bigint-id.pipe.js';
import { CrearDetalleTarjetaRequestDto } from './dto/crear-detalle-tarjeta-request.dto.js';
import { DetalleTarjetaResponseDto } from './dto/detalle-tarjeta-response.dto.js';
import { PagoTarjetaService } from './pago_tarjeta.service.js';

@InfrastructureRoles('ADMIN')
@Controller('pagos/:id/tarjeta')
export class PagoTarjetaController {
  constructor(private readonly pagoTarjetaService: PagoTarjetaService) {}

  @Post()
  crear(
    @Param('id', BigIntIdPipe) id: string,
    @Body() request: CrearDetalleTarjetaRequestDto,
  ): Promise<DetalleTarjetaResponseDto> {
    return this.pagoTarjetaService.crear(id, request);
  }

  @Get()
  obtener(
    @Param('id', BigIntIdPipe) id: string,
  ): Promise<DetalleTarjetaResponseDto> {
    return this.pagoTarjetaService.obtener(id);
  }
}
