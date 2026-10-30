import { InfrastructureRoles } from '@booking/infrastructure';
import { Controller, Get, Param, ParseBoolPipe, Query } from '@nestjs/common';
import { MetodoPagoService } from './metodo_pago.service.js';
import { SmallIntIdPipe } from '../common/pipes/smallint-id.pipe.js';

@InfrastructureRoles('ADMIN')
@Controller('metodos-pago')
export class MetodoPagoController {
  constructor(private readonly metodoPagoService: MetodoPagoService) {}

  @Get()
  listar(
    @Query('activo', new ParseBoolPipe({ optional: true })) activo?: boolean,
  ) {
    return this.metodoPagoService.listar(activo);
  }

  @Get(':id')
  obtenerPorId(@Param('id', SmallIntIdPipe) id: number) {
    return this.metodoPagoService.obtenerPorId(id);
  }
}
