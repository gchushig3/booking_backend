import { ApiExtraModels } from '@nestjs/swagger';
import { JsonSchemaValidationPipe } from '@booking/infrastructure';
import { BookingCatalogService } from '../../booking/booking-catalog.service.js';
import { CatalogEventsService } from '../../booking/catalog-events.service.js';
import { profileSchema, searchSchema } from '../../booking/booking.schemas.js';
import type { BookingSearch } from '../../booking/booking.schemas.js';
import type { BookingProfile } from '../../booking/booking-profile.entity.js';
import { paginatedSchema } from '../../common/openapi/paginated-schema.js';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PublicEndpoint } from '../../common/public-endpoint.decorator.js';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
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
import { AttractionsService } from './attractions.service.js';
import { CreateAttractionDto } from './dto/create-attraction.dto.js';
import { UpdateAttractionDto } from './dto/update-attraction.dto.js';
import { UpdateAttractionStatusDto } from './dto/update-attraction-status.dto.js';
import {
  SyncCategoriesDto,
  SyncLanguagesDto,
  SyncInclusionsDto,
} from './dto/sync-relations.dto.js';
import {
  CreatePhotoDto,
  UpdatePhotoDto,
  PhotoResponseDto,
} from './dto/photo.dto.js';
import {
  AttractionCategorySummary,
  AttractionInclusionSummary,
  AttractionLanguageSummary,
  AttractionResponseDto,
} from './dto/attraction-response.dto.js';

@ApiTags('Atracciones')
@Controller('atracciones')
export class AttractionsController {
  constructor(
    private readonly attractionsService: AttractionsService,
    private readonly booking: BookingCatalogService,
    private readonly events: CatalogEventsService,
  ) {}

  // ==================== Consultas Públicas ====================

  @PublicEndpoint()
  @Get()
  @ApiOperation({
    summary: 'Listar atracciones públicas',
    description:
      'Retorna atracciones publicadas con paginación y filtros opcionales.',
  })
  @ApiExtraModels(AttractionResponseDto)
  @ApiOkResponse({
    schema: paginatedSchema(AttractionResponseDto),
    description: 'Lista paginada de atracciones publicadas.',
  })
  async getPublicList(
    @Query() query: Record<string, unknown>,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const allowed = [
      'city',
      'categoria_id',
      'incluye_comida',
      'incluye_transporte',
      'incluye_guia',
      'page',
      'limit',
      'sort',
    ];
    if (Object.keys(query).some((key) => !allowed.includes(key)))
      throw new BadRequestException('Parametro de consulta no permitido');
    const input: Record<string, unknown> = { ...query };
    for (const key of [
      'incluye_comida',
      'incluye_transporte',
      'incluye_guia',
    ]) {
      if (input[key] !== undefined) {
        if (
          typeof input[key] !== 'string' ||
          !['true', 'false'].includes(input[key])
        )
          throw new BadRequestException(`Parametro ${key} invalido`);
        input[key] = input[key] === 'true';
      }
    }
    for (const key of ['page', 'limit']) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== 'string' || !/^[1-9]\d*$/.test(input[key]))
          throw new BadRequestException(`Parametro ${key} invalido`);
        input[key] = Number(input[key]);
      }
    }
    if (input.city !== undefined && typeof input.city !== 'string')
      throw new BadRequestException('city invalida');
    if (
      input.categoria_id !== undefined &&
      typeof input.categoria_id !== 'string'
    )
      throw new BadRequestException('categoria_id invalida');
    if (
      input.sort !== undefined &&
      (typeof input.sort !== 'string' ||
        !['PRICE_ASC', 'PRICE_DESC', 'RATING_DESC', 'POPULARITY'].includes(
          input.sort,
        ))
    )
      throw new BadRequestException('sort invalido');
    return this.booking.search(input, correlationId);
  }

  @PublicEndpoint()
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar atracciones públicas',
    description:
      'Búsqueda avanzada de atracciones publicadas con filtros en el cuerpo.',
  })
  @ApiExtraModels(AttractionResponseDto)
  @ApiOkResponse({
    schema: paginatedSchema(AttractionResponseDto),
    description: 'Resultados paginados de la búsqueda.',
  })
  async search(
    @Body(new JsonSchemaValidationPipe(searchSchema)) dto: BookingSearch,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.booking.search(dto, correlationId);
  }

  // ==================== Administración de Atracciones ====================

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una atracción',
    description:
      'Crea una nueva atracción en estado BORRADOR. Requiere operador activo.',
  })
  @ApiCreatedResponse({
    type: AttractionResponseDto,
    description: 'Atracción creada exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  @ApiConflictResponse({ description: 'Slug duplicado.' })
  async create(
    @Body() dto: CreateAttractionDto,
  ): Promise<AttractionResponseDto> {
    return this.attractionsService.create(dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Cambiar estado de una atracción',
    description: 'Cambia el estado a BORRADOR, PUBLICADA o INACTIVA.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiOkResponse({
    type: AttractionResponseDto,
    description: 'Estado actualizado.',
  })
  @ApiBadRequestResponse({ description: 'Estado inválido.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAttractionStatusDto,
  ): Promise<AttractionResponseDto> {
    return this.attractionsService.updateStatus(id, dto.status);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Put(':id/categorias')
  @ApiOperation({
    summary: 'Sincronizar categorías de una atracción',
    description: 'Reemplaza todas las categorías asociadas a la atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiOkResponse({
    type: AttractionCategorySummary,
    isArray: true,
    description: 'Categorías sincronizadas.',
  })
  @ApiNotFoundResponse({ description: 'Atracción o categoría no encontrada.' })
  async syncCategories(
    @Param('id') id: string,
    @Body() dto: SyncCategoriesDto,
  ): Promise<AttractionCategorySummary[]> {
    return this.attractionsService.syncCategories(id, dto.category_ids);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Put(':id/idiomas')
  @ApiOperation({
    summary: 'Sincronizar idiomas de una atracción',
    description: 'Reemplaza todos los idiomas asociados a la atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiOkResponse({
    type: AttractionLanguageSummary,
    isArray: true,
    description: 'Idiomas sincronizados.',
  })
  @ApiNotFoundResponse({ description: 'Atracción o idioma no encontrado.' })
  async syncLanguages(
    @Param('id') id: string,
    @Body() dto: SyncLanguagesDto,
  ): Promise<AttractionLanguageSummary[]> {
    return this.attractionsService.syncLanguages(id, dto.language_ids);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Put(':id/inclusiones')
  @ApiOperation({
    summary: 'Sincronizar inclusiones de una atracción',
    description: 'Reemplaza todas las inclusiones asociadas a la atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiOkResponse({
    type: AttractionInclusionSummary,
    isArray: true,
    description: 'Inclusiones sincronizadas.',
  })
  @ApiNotFoundResponse({ description: 'Atracción o inclusión no encontrada.' })
  async syncInclusions(
    @Param('id') id: string,
    @Body() dto: SyncInclusionsDto,
  ): Promise<AttractionInclusionSummary[]> {
    return this.attractionsService.syncInclusions(id, dto.inclusion_ids);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post(':id/fotos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Agregar fotografía a una atracción',
    description: 'Agrega una nueva fotografía con URL y metadatos.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiCreatedResponse({
    type: PhotoResponseDto,
    description: 'Fotografía creada.',
  })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  async addPhoto(
    @Param('id') id: string,
    @Body() dto: CreatePhotoDto,
  ): Promise<PhotoResponseDto> {
    return this.attractionsService.addPhoto(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id/fotos/:fotoId')
  @ApiOperation({
    summary: 'Actualizar fotografía de una atracción',
    description:
      'Actualiza URL, texto alternativo u orden de una fotografía existente.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiParam({ name: 'fotoId', description: 'ID de la fotografía.' })
  @ApiOkResponse({
    type: PhotoResponseDto,
    description: 'Fotografía actualizada.',
  })
  @ApiNotFoundResponse({ description: 'Atracción o fotografía no encontrada.' })
  async updatePhoto(
    @Param('id') id: string,
    @Param('fotoId') fotoId: string,
    @Body() dto: UpdatePhotoDto,
  ): Promise<PhotoResponseDto> {
    return this.attractionsService.updatePhoto(id, fotoId, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id/fotos/:fotoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar fotografía de una atracción',
    description:
      'Elimina permanentemente una fotografía asociada a la atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiParam({ name: 'fotoId', description: 'ID de la fotografía.' })
  @ApiNoContentResponse({ description: 'Fotografía eliminada.' })
  @ApiNotFoundResponse({ description: 'Atracción o fotografía no encontrada.' })
  async deletePhoto(
    @Param('id') id: string,
    @Param('fotoId') fotoId: string,
  ): Promise<void> {
    return this.attractionsService.deletePhoto(id, fotoId);
  }

  @PublicEndpoint()
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle público de una atracción',
    description:
      'Retorna la atracción por ID, UUID o slug. Solo atracciones PUBLICADAS y no eliminadas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID numérico, UUID o slug de la atracción.',
  })
  @ApiOkResponse({
    type: AttractionResponseDto,
    description: 'Detalle de la atracción.',
  })
  @ApiNotFoundResponse({
    description: 'Atracción no encontrada o no disponible públicamente.',
  })
  async getPublicDetail(
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const detail = await this.booking.detail(id);
    await this.events.consulted(detail.id, correlationId);
    return detail;
  }

  @ApiBearerAuth('jwt')
  @Put(':id/booking')
  @ApiOperation({
    summary:
      'Guardar proyeccion Booking de ciudad, tarifas e itinerario (ADMIN)',
  })
  saveBookingProfile(
    @Param('id') id: string,
    @Body(new JsonSchemaValidationPipe(profileSchema)) profile: BookingProfile,
  ) {
    return this.booking.saveProfile(id, profile);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una atracción',
    description: 'Actualiza parcialmente los datos de una atracción existente.',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiOkResponse({
    type: AttractionResponseDto,
    description: 'Atracción actualizada.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  @ApiConflictResponse({ description: 'Slug duplicado.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttractionDto,
  ): Promise<AttractionResponseDto> {
    return this.attractionsService.update(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar lógicamente una atracción',
    description:
      'Establece atr_eliminado_en con la fecha actual (borrado lógico).',
  })
  @ApiParam({ name: 'id', description: 'ID, UUID o slug de la atracción.' })
  @ApiNoContentResponse({ description: 'Atracción eliminada lógicamente.' })
  @ApiNotFoundResponse({ description: 'Atracción no encontrada.' })
  async softDelete(@Param('id') id: string): Promise<void> {
    return this.attractionsService.softDelete(id);
  }
}
