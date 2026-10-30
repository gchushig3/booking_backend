import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { BookingCatalogService } from '../../booking/booking-catalog.service.js';
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
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto.js';

@ApiTags('Categorías')
@Controller('atracciones/categorias')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly booking: BookingCatalogService,
  ) {}

  @PublicEndpoint()
  @Get('arbol')
  @ApiOperation({
    summary: 'Obtener árbol jerárquico de categorías',
    description:
      'Retorna las categorías activas organizadas en estructura padre-hijo.',
  })
  @ApiOkResponse({
    type: CategoryTreeNodeDto,
    isArray: true,
    description: 'Árbol de categorías.',
  })
  async getTree() {
    return this.booking.categories(undefined, true);
  }

  @PublicEndpoint()
  @Get()
  @ApiOperation({
    summary: 'Listar categorías (plano)',
    description:
      'Retorna todas las categorías en formato plano con filtros opcionales.',
  })
  @ApiOkResponse({
    type: CategoryResponseDto,
    isArray: true,
    description: 'Lista plana de categorías.',
  })
  async getFlat(@Query('padre_id') parent?: string) {
    return this.booking.categories(parent);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una categoría',
    description:
      'Crea una nueva categoría. El slug se genera automáticamente si no se proporciona.',
  })
  @ApiCreatedResponse({
    type: CategoryResponseDto,
    description: 'Categoría creada.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos o ciclo detectado.' })
  @ApiConflictResponse({ description: 'Slug duplicado.' })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una categoría',
    description:
      'Actualiza parcialmente una categoría. Detecta ciclos padre-hijo.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico de la categoría.' })
  @ApiOkResponse({
    type: CategoryResponseDto,
    description: 'Categoría actualizada.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos o ciclo detectado.' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada.' })
  @ApiConflictResponse({ description: 'Slug duplicado.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar una categoría',
    description:
      'Elimina una categoría si no tiene subcategorías ni atracciones asociadas.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico de la categoría.' })
  @ApiNoContentResponse({ description: 'Categoría eliminada.' })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada.' })
  @ApiConflictResponse({ description: 'Categoría con dependencias activas.' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.delete(id);
  }
}
