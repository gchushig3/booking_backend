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
  Put,
  Query,
} from '@nestjs/common';
import {
  bigintIdSchema,
  InfrastructureRoles,
  JsonSchemaValidationPipe,
  PublicInfrastructure,
} from '@booking/infrastructure';
import { CuponService } from './cupon.service.js';
import { Cupon } from './cupon.entity.js';
import {
  createCuponSchema,
  updateCuponSchema,
  validateCuponSchema,
} from './cupon.schemas.js';
import type { CreateCuponInput, UpdateCuponInput } from './cupon.schemas.js';

@Controller('cupones')
export class CuponesController {
  constructor(private readonly cuponService: CuponService) {}

  @Get()
  @PublicInfrastructure()
  findAll(): Promise<Cupon[]> {
    return this.cuponService.findAll();
  }

  @Get('codigo/:cupCodigo')
  @PublicInfrastructure()
  findByCodigo(@Param('cupCodigo') cupCodigo: string): Promise<Cupon> {
    return this.cuponService.findByCodigo(cupCodigo);
  }

  @Get('validar/:cupCodigo')
  @PublicInfrastructure()
  validate(
    @Param('cupCodigo') code: string,
    @Query(new JsonSchemaValidationPipe(validateCuponSchema))
    query: { fecha?: string },
  ) {
    return this.cuponService.validate(code, query.fecha);
  }

  @Get(':id')
  @PublicInfrastructure()
  findOne(
    @Param('id', new JsonSchemaValidationPipe<string>(bigintIdSchema))
    id: string,
  ): Promise<Cupon> {
    return this.cuponService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @InfrastructureRoles('ADMIN')
  create(
    @Body(new JsonSchemaValidationPipe(createCuponSchema))
    body: CreateCuponInput,
  ): Promise<Cupon> {
    return this.cuponService.create(body);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @InfrastructureRoles('ADMIN')
  replace(
    @Param('id', new JsonSchemaValidationPipe<string>(bigintIdSchema))
    id: string,
    @Body(new JsonSchemaValidationPipe(createCuponSchema))
    body: CreateCuponInput,
  ): Promise<void> {
    return this.cuponService.update(id, body).then(() => undefined);
  }

  @Patch(':id')
  @InfrastructureRoles('ADMIN')
  update(
    @Param('id', new JsonSchemaValidationPipe<string>(bigintIdSchema))
    id: string,
    @Body(new JsonSchemaValidationPipe(updateCuponSchema))
    body: UpdateCuponInput,
  ): Promise<Cupon> {
    return this.cuponService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @InfrastructureRoles('ADMIN')
  remove(
    @Param('id', new JsonSchemaValidationPipe<string>(bigintIdSchema))
    id: string,
  ): Promise<void> {
    return this.cuponService.remove(id).then(() => undefined);
  }
}
