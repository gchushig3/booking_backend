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
import { LanguagesService } from './languages.service.js';
import { CreateLanguageDto } from './dto/create-language.dto.js';
import { UpdateLanguageDto } from './dto/update-language.dto.js';
import { LanguageResponseDto } from './dto/language-response.dto.js';

@ApiTags('Idiomas')
@Controller('idiomas')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @PublicEndpoint()
  @Get()
  @ApiOperation({
    summary: 'Listar todos los idiomas',
    description: 'Retorna la lista completa de idiomas disponibles.',
  })
  @ApiOkResponse({
    type: LanguageResponseDto,
    isArray: true,
    description: 'Lista de idiomas.',
  })
  async findAll(): Promise<LanguageResponseDto[]> {
    return this.languagesService.findAll();
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un idioma por ID',
    description: 'Retorna un idioma específico por su identificador numérico.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del idioma.' })
  @ApiOkResponse({
    type: LanguageResponseDto,
    description: 'Detalle del idioma.',
  })
  @ApiNotFoundResponse({ description: 'Idioma no encontrado.' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LanguageResponseDto> {
    return this.languagesService.findById(id);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un idioma',
    description:
      'Crea un nuevo idioma. El código ISO 639-1 se normaliza a minúsculas.',
  })
  @ApiCreatedResponse({
    type: LanguageResponseDto,
    description: 'Idioma creado.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConflictResponse({ description: 'Código de idioma duplicado.' })
  async create(@Body() dto: CreateLanguageDto): Promise<LanguageResponseDto> {
    return this.languagesService.create(dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un idioma',
    description: 'Actualiza parcialmente el nombre de un idioma existente.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del idioma.' })
  @ApiOkResponse({
    type: LanguageResponseDto,
    description: 'Idioma actualizado.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Idioma no encontrado.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLanguageDto,
  ): Promise<LanguageResponseDto> {
    return this.languagesService.update(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un idioma',
    description: 'Elimina un idioma si no está asociado a ninguna atracción.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del idioma.' })
  @ApiNoContentResponse({ description: 'Idioma eliminado.' })
  @ApiNotFoundResponse({ description: 'Idioma no encontrado.' })
  @ApiConflictResponse({ description: 'Idioma asociado a atracciones.' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.languagesService.delete(id);
  }
}
