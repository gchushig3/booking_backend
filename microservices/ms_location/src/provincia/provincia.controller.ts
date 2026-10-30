import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  InfrastructureRoles,
  PublicInfrastructure,
} from '@booking/infrastructure';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProvinciaService } from './provincia.service.js';
import { CreateProvinciaDto } from './dto/create-provincia.dto.js';
import { UpdateProvinciaDto } from './dto/update-provincia.dto.js';
import { Provincia } from './provincia.entity.js';

@ApiTags('provincias')
@Controller('provincias')
export class ProvinciasController {
  constructor(private readonly provinciaService: ProvinciaService) {}

  @Get()
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Listar provincias (filtro opcional por reg_id)' })
  @ApiOkResponse({ type: [Provincia] })
  findAll(@Query('reg_id') regId?: string): Promise<Provincia[]> {
    const regionId = regId !== undefined ? Number(regId) : undefined;
    return this.provinciaService.findAll(regionId);
  }

  @Get(':id')
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Obtener una provincia por su identificador' })
  @ApiOkResponse({ type: Provincia })
  @ApiNotFoundResponse({ description: 'Provincia no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Provincia> {
    return this.provinciaService.findOne(id);
  }

  @Post()
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una provincia' })
  @ApiCreatedResponse({ type: Provincia })
  @ApiBadRequestResponse({ description: 'Datos de entrada invalidos' })
  async create(
    @Body() createProvinciaDto: CreateProvinciaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Provincia> {
    const provincia = await this.provinciaService.create(createProvinciaDto);
    res.setHeader('Location', `/api/v1/provincias/${provincia.prov_id}`);
    return provincia;
  }

  @Put(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar una provincia' })
  @ApiNoContentResponse({ description: 'Provincia reemplazada' })
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() createProvinciaDto: CreateProvinciaDto,
  ): Promise<void> {
    return this.provinciaService
      .update(id, createProvinciaDto)
      .then(() => undefined);
  }

  @Patch(':id')
  @InfrastructureRoles('ADMIN')
  @ApiOperation({ summary: 'Actualizar parcialmente una provincia' })
  @ApiOkResponse({ type: Provincia })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProvinciaDto: UpdateProvinciaDto,
  ): Promise<Provincia> {
    return this.provinciaService.update(id, updateProvinciaDto);
  }

  @Delete(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una provincia' })
  @ApiNoContentResponse({ description: 'Provincia eliminada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.provinciaService.remove(id).then(() => undefined);
  }
}
