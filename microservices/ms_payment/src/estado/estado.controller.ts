import { InfrastructureRoles } from '@booking/infrastructure';
import { Controller, Get, Param } from '@nestjs/common';
import { EstadoService } from './estado.service.js';
import { SmallIntIdPipe } from '../common/pipes/smallint-id.pipe.js';

@InfrastructureRoles('ADMIN')
@Controller('estados-pago')
export class EstadoController {
  constructor(private readonly estadoService: EstadoService) {}

  @Get()
  listar() {
    return this.estadoService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', SmallIntIdPipe) id: number) {
    return this.estadoService.obtenerPorId(id);
  }
}
