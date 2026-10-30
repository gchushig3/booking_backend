import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PublicEndpoint } from '../../common/public-endpoint.decorator.js';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { InclusionsService } from './inclusions.service.js';
import { CreateInclusionDto } from './dto/create-inclusion.dto.js';
import { UpdateInclusionDto } from './dto/update-inclusion.dto.js';
import { FilterInclusionsQueryDto } from './dto/filter-inclusions-query.dto.js';
import { InclusionResponseDto } from './dto/inclusion-response.dto.js';

@ApiTags('Inclusiones')
@Controller('inclusiones')
export class InclusionsController {
  constructor(private readonly inclusionsService: InclusionsService) {}

  @PublicEndpoint()
  @Get()
  @ApiOperation({
    summary: 'Listar inclusiones',
    description:
      'Retorna las inclusiones disponibles. Filtro opcional por tipo (INCLUYE, NO_INCLUYE, RECOMENDACION).',
  })
  @ApiOkResponse({
    type: InclusionResponseDto,
    isArray: true,
    description: 'Lista de inclusiones.',
  })
  async findAll(
    @Query() query: FilterInclusionsQueryDto,
  ): Promise<InclusionResponseDto[]> {
    return this.inclusionsService.findAll(query);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una inclusión por ID',
    description:
      'Retorna una inclusión específica por su identificador numérico.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico de la inclusión.' })
  @ApiOkResponse({
    type: InclusionResponseDto,
    description: 'Detalle de la inclusión.',
  })
  @ApiNotFoundResponse({ description: 'Inclusión no encontrada.' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InclusionResponseDto> {
    return this.inclusionsService.findById(id);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una inclusión',
    description:
      'Crea una nueva inclusión con tipo (INCLUYE, NO_INCLUYE, RECOMENDACION) y nombre.',
  })
  @ApiCreatedResponse({
    type: InclusionResponseDto,
    description: 'Inclusión creada.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConflictResponse({ description: 'Par (tipo, nombre) duplicado.' })
  async create(@Body() dto: CreateInclusionDto): Promise<InclusionResponseDto> {
    return this.inclusionsService.create(dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una inclusión',
    description: 'Actualiza parcialmente una inclusión existente.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico de la inclusión.' })
  @ApiOkResponse({
    type: InclusionResponseDto,
    description: 'Inclusión actualizada.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Inclusión no encontrada.' })
  @ApiConflictResponse({ description: 'Par (tipo, nombre) duplicado.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInclusionDto,
  ): Promise<InclusionResponseDto> {
    return this.inclusionsService.update(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar una inclusión',
    description:
      'Elimina una inclusión si no está asociada a ninguna atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico de la inclusión.' })
  @ApiNoContentResponse({ description: 'Inclusión eliminada.' })
  @ApiNotFoundResponse({ description: 'Inclusión no encontrada.' })
  @ApiConflictResponse({ description: 'Inclusión asociada a atracciones.' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.inclusionsService.delete(id);
  }
}
