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
import { CiudadService } from './ciudad.service.js';
import { CreateCiudadDto } from './dto/create-ciudad.dto.js';
import { UpdateCiudadDto } from './dto/update-ciudad.dto.js';
import { Ciudad } from './ciudad.entity.js';

@ApiTags('ciudades')
@Controller('ciudades')
export class CiudadesController {
  constructor(private readonly ciudadService: CiudadService) {}

  @Get()
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Listar ciudades (filtro opcional por prov_id)' })
  @ApiOkResponse({ type: [Ciudad] })
  findAll(@Query('prov_id') provId?: string): Promise<Ciudad[]> {
    const provinciaId = provId !== undefined ? Number(provId) : undefined;
    return this.ciudadService.findAll(provinciaId);
  }

  @Get(':id')
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Obtener una ciudad por su identificador' })
  @ApiOkResponse({ type: Ciudad })
  @ApiNotFoundResponse({ description: 'Ciudad no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Ciudad> {
    return this.ciudadService.findOne(id);
  }

  @Post()
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una ciudad' })
  @ApiCreatedResponse({ type: Ciudad })
  @ApiBadRequestResponse({ description: 'Datos de entrada invalidos' })
  async create(
    @Body() createCiudadDto: CreateCiudadDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ciudad> {
    const ciudad = await this.ciudadService.create(createCiudadDto);
    res.setHeader('Location', `/api/v1/ciudades/${ciudad.ciu_id}`);
    return ciudad;
  }

  @Put(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar una ciudad' })
  @ApiNoContentResponse({ description: 'Ciudad reemplazada' })
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() createCiudadDto: CreateCiudadDto,
  ): Promise<void> {
    return this.ciudadService.update(id, createCiudadDto).then(() => undefined);
  }

  @Patch(':id')
  @InfrastructureRoles('ADMIN')
  @ApiOperation({ summary: 'Actualizar parcialmente una ciudad' })
  @ApiOkResponse({ type: Ciudad })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCiudadDto: UpdateCiudadDto,
  ): Promise<Ciudad> {
    return this.ciudadService.update(id, updateCiudadDto);
  }

  @Delete(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una ciudad' })
  @ApiNoContentResponse({ description: 'Ciudad eliminada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.ciudadService.remove(id).then(() => undefined);
  }
}
