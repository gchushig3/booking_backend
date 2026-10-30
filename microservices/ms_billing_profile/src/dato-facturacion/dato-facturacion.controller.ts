import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  bigintIdSchema,
  JsonSchemaValidationPipe,
  type SagaHttpRequest,
} from '@booking/infrastructure';
import { DatoFacturacionService } from './dato-facturacion.service.js';
import type { DatoFacturacion } from './dato-facturacion.entity.js';
import {
  createDatoFacturacionSchema,
  updateDatoFacturacionSchema,
} from './dato-facturacion.schemas.js';
import type {
  DatoFacturacionInput,
  UpdateDatoFacturacionInput,
} from './dato-facturacion.schemas.js';

const idPipe = new JsonSchemaValidationPipe<string>(bigintIdSchema);

@Controller('billing-profiles')
export class DatoFacturacionController {
  constructor(private readonly service: DatoFacturacionService) {}

  @Get()
  list(@Req() request: SagaHttpRequest): Promise<DatoFacturacion[]> {
    return this.service.list(request.principal.userId);
  }

  @Get(':id')
  get(
    @Req() request: SagaHttpRequest,
    @Param('id', idPipe) id: string,
  ): Promise<DatoFacturacion> {
    return this.service.get(request.principal.userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: SagaHttpRequest,
    @Body(new JsonSchemaValidationPipe(createDatoFacturacionSchema))
    body: DatoFacturacionInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DatoFacturacion> {
    const dato = await this.service.create(request.principal.userId, body);
    response.setHeader('Location', `/api/v2/billing-profiles/${dato.dfa_id}`);
    return dato;
  }

  @Patch(':id')
  update(
    @Req() request: SagaHttpRequest,
    @Param('id', idPipe) id: string,
    @Body(new JsonSchemaValidationPipe(updateDatoFacturacionSchema))
    body: UpdateDatoFacturacionInput,
  ): Promise<DatoFacturacion> {
    return this.service.update(request.principal.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() request: SagaHttpRequest,
    @Param('id', idPipe) id: string,
  ): Promise<void> {
    return this.service.remove(request.principal.userId, id);
  }
}
