import { InfrastructureRoles } from '@booking/infrastructure';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PagoService } from './pago.service.js';
import { CrearPagoRequestDto } from './dto/crear-pago-request.dto.js';
import { ListarPagosQueryDto } from './dto/listar-pagos-query.dto.js';
import { BigIntIdPipe } from '../common/pipes/bigint-id.pipe.js';
import { SimularPagoRequestDto } from './dto/simular-pago-request.dto.js';

@InfrastructureRoles('ADMIN')
@Controller('pagos')
export class PagoController {
  constructor(private readonly pagoService: PagoService) {}

  @Post()
  async crear(
    @Body() request: CrearPagoRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.pagoService.crear(request);
    response.status(result.status);
    if (result.status === HttpStatus.CREATED) {
      response.setHeader('Location', `/api/v2/pagos/${result.pago.id}`);
    }
    return result.pago;
  }

  @Get()
  listar(@Query() query: ListarPagosQueryDto) {
    return this.pagoService.listar(query);
  }

  @Get(':id')
  obtenerPorId(@Param('id', BigIntIdPipe) id: string) {
    return this.pagoService.obtenerPorId(id);
  }

  @Post(':id/simulaciones')
  @HttpCode(HttpStatus.OK)
  simular(
    @Param('id', BigIntIdPipe) id: string,
    @Body() request: SimularPagoRequestDto,
  ) {
    return this.pagoService.simular(id, request);
  }
}
