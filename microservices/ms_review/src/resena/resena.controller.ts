import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  bigintIdSchema,
  InfrastructureRoles,
  JsonSchemaValidationPipe,
  PublicInfrastructure,
  type SagaHttpRequest,
} from '@booking/infrastructure';
import { ResenaService } from './resena.service.js';
import type { Resena } from './resena.entity.js';
import { createResenaSchema, visibilitySchema } from './resena.schemas.js';
import type { ResenaInput } from './resena.schemas.js';

const idPipe = new JsonSchemaValidationPipe<string>(bigintIdSchema);

@Controller('reviews')
export class ResenaController {
  constructor(private readonly service: ResenaService) {}

  @Get()
  @PublicInfrastructure()
  list(@Query('atr_id', idPipe) atrId: string): Promise<Resena[]> {
    return this.service.listVisible(atrId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: SagaHttpRequest,
    @Body(new JsonSchemaValidationPipe(createResenaSchema)) body: ResenaInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Resena> {
    const resena = await this.service.create(request.principal.userId, body);
    response.setHeader('Location', `/api/v2/reviews/${resena.ren_id}`);
    return resena;
  }

  @Patch(':id/visibility')
  @InfrastructureRoles('ADMIN')
  setVisible(
    @Param('id', idPipe) id: string,
    @Body(new JsonSchemaValidationPipe(visibilitySchema))
    body: { ren_visible: boolean },
  ): Promise<Resena> {
    return this.service.setVisible(id, body.ren_visible);
  }
}
