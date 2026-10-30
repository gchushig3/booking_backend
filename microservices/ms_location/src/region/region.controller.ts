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
import { RegionService } from './region.service.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { UpdateRegionDto } from './dto/update-region.dto.js';
import { Region } from './region.entity.js';

@ApiTags('regiones')
@Controller('regiones')
export class RegionsController {
  constructor(private readonly regionService: RegionService) {}

  @Get()
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Listar todas las regiones' })
  @ApiOkResponse({ type: [Region] })
  findAll(): Promise<Region[]> {
    return this.regionService.findAll();
  }

  @Get(':id')
  @PublicInfrastructure()
  @ApiOperation({ summary: 'Obtener una region por su identificador' })
  @ApiOkResponse({ type: Region })
  @ApiNotFoundResponse({ description: 'Region no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Region> {
    return this.regionService.findOne(id);
  }

  @Post()
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una region' })
  @ApiCreatedResponse({ type: Region })
  @ApiBadRequestResponse({ description: 'Datos de entrada invalidos' })
  async create(
    @Body() createRegionDto: CreateRegionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Region> {
    const region = await this.regionService.create(createRegionDto);
    res.setHeader('Location', `/api/v1/regiones/${region.reg_id}`);
    return region;
  }

  @Put(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar una region' })
  @ApiNoContentResponse({ description: 'Region reemplazada' })
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() createRegionDto: CreateRegionDto,
  ): Promise<void> {
    return this.regionService.update(id, createRegionDto).then(() => undefined);
  }

  @Patch(':id')
  @InfrastructureRoles('ADMIN')
  @ApiOperation({ summary: 'Actualizar parcialmente una region' })
  @ApiOkResponse({ type: Region })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegionDto: UpdateRegionDto,
  ): Promise<Region> {
    return this.regionService.update(id, updateRegionDto);
  }

  @Delete(':id')
  @InfrastructureRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una region' })
  @ApiNoContentResponse({ description: 'Region eliminada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.regionService.remove(id).then(() => undefined);
  }
}
