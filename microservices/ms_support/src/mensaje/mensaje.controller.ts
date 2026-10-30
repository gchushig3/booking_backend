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
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  bigintIdSchema,
  InfrastructureRoles,
  JsonSchemaValidationPipe,
} from '@booking/infrastructure';
import { MensajeService } from './mensaje.service.js';
import type { Mensaje } from './mensaje.entity.js';
import {
  createMensajeSchema,
  markReadSchema,
  readFilterSchema,
} from './mensaje.schemas.js';
import type { MensajeInput } from './mensaje.schemas.js';

const idPipe = new JsonSchemaValidationPipe<string>(bigintIdSchema);
const filterPipe = new JsonSchemaValidationPipe<'true' | 'false'>(
  readFilterSchema,
);

// Cualquier usuario autenticado escribe; solo ADMIN lee o gestiona mensajes.
@Controller('support/messages')
export class MensajesController {
  constructor(private readonly service: MensajeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new JsonSchemaValidationPipe(createMensajeSchema))
    body: MensajeInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Mensaje> {
    const mensaje = await this.service.create(body);
    response.setHeader(
      'Location',
      `/api/v2/support/messages/${mensaje.men_id}`,
    );
    return mensaje;
  }

  @Get()
  @InfrastructureRoles('ADMIN')
  list(@Query('leido') leido?: string): Promise<Mensaje[]> {
    const filter =
      leido === undefined ? undefined : filterPipe.transform(leido);
    return this.service.list(
      filter === undefined ? undefined : filter === 'true',
    );
  }

  @Get(':id')
  @InfrastructureRoles('ADMIN')
  get(@Param('id', idPipe) id: string): Promise<Mensaje> {
    return this.service.get(id);
  }

  @Patch(':id')
  @InfrastructureRoles('ADMIN')
  markRead(
    @Param('id', idPipe) id: string,
    @Body(new JsonSchemaValidationPipe(markReadSchema))
    body: { men_leido: boolean },
  ): Promise<Mensaje> {
    return this.service.markRead(id, body.men_leido);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @InfrastructureRoles('ADMIN')
  remove(@Param('id', idPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
