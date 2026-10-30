import { ApiExtraModels } from '@nestjs/swagger';
import { paginatedSchema } from '../../common/openapi/paginated-schema.js';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
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
import { OperatorsService } from './operators.service.js';
import { CreateOperatorDto } from './dto/create-operator.dto.js';
import { UpdateOperatorDto } from './dto/update-operator.dto.js';
import { FilterOperatorsQueryDto } from './dto/filter-operators-query.dto.js';
import {
  AssociateOperatorUserDto,
  UpdateOperatorUserDto,
  OperatorUserResponseDto,
} from './dto/operator-user.dto.js';
import { OperatorResponseDto } from './dto/operator-response.dto.js';
import type { PaginatedResponse } from '../../common/pagination/paginated-response.dto.js';

@ApiTags('Operadores')
@Controller('operadores')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Get()
  @ApiOperation({
    summary: 'Listar operadores',
    description:
      'Retorna operadores paginados con filtros opcionales por estado, provincia y búsqueda.',
  })
  @ApiExtraModels(OperatorResponseDto)
  @ApiOkResponse({
    schema: paginatedSchema(OperatorResponseDto),
    description: 'Lista paginada de operadores.',
  })
  async findAll(
    @Query() query: FilterOperatorsQueryDto,
  ): Promise<PaginatedResponse<OperatorResponseDto>> {
    return this.operatorsService.findAll(query);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un operador por ID',
    description: 'Retorna un operador específico con sus usuarios asociados.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador (BIGINT).' })
  @ApiOkResponse({
    type: OperatorResponseDto,
    description: 'Detalle del operador.',
  })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  async findById(@Param('id') id: string): Promise<OperatorResponseDto> {
    return this.operatorsService.findById(id);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un operador',
    description: 'Crea un nuevo operador turístico con código único.',
  })
  @ApiCreatedResponse({
    type: OperatorResponseDto,
    description: 'Operador creado.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiConflictResponse({ description: 'Código o RUC duplicado.' })
  async create(@Body() dto: CreateOperatorDto): Promise<OperatorResponseDto> {
    return this.operatorsService.create(dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un operador',
    description: 'Actualiza parcialmente los datos de un operador existente.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiOkResponse({
    type: OperatorResponseDto,
    description: 'Operador actualizado.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  @ApiConflictResponse({ description: 'Código o RUC duplicado.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorDto,
  ): Promise<OperatorResponseDto> {
    return this.operatorsService.update(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un operador',
    description:
      'Desactiva un operador. Si tiene atracciones, se desactiva en lugar de eliminarse.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiNoContentResponse({ description: 'Operador desactivado/eliminado.' })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.operatorsService.delete(id);
  }

  // ==================== Usuarios del Operador ====================

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Get(':id/usuarios')
  @ApiOperation({
    summary: 'Listar usuarios de un operador',
    description: 'Retorna los usuarios asociados a un operador con sus roles.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiOkResponse({
    type: OperatorUserResponseDto,
    isArray: true,
    description: 'Lista de usuarios asociados.',
  })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  async listUsers(@Param('id') id: string): Promise<OperatorUserResponseDto[]> {
    return this.operatorsService.listUsers(id);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Post(':id/usuarios')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Asociar usuario a un operador',
    description:
      'Asocia un usuario (por ID de Identity) a un operador con un rol (ADMIN, VENDEDOR, GUIA).',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiCreatedResponse({
    type: OperatorUserResponseDto,
    description: 'Usuario asociado.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Operador no encontrado.' })
  @ApiConflictResponse({ description: 'Usuario ya asociado al operador.' })
  async associateUser(
    @Param('id') id: string,
    @Body() dto: AssociateOperatorUserDto,
  ): Promise<OperatorUserResponseDto> {
    return this.operatorsService.associateUser(id, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Patch(':id/usuarios/:usuId')
  @ApiOperation({
    summary: 'Actualizar asociación usuario-operador',
    description:
      'Actualiza el rol o estado activo de un usuario asociado a un operador.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiParam({ name: 'usuId', description: 'ID del usuario (de ms_identity).' })
  @ApiOkResponse({
    type: OperatorUserResponseDto,
    description: 'Asociación actualizada.',
  })
  @ApiNotFoundResponse({ description: 'Operador o asociación no encontrada.' })
  async updateUser(
    @Param('id') id: string,
    @Param('usuId') usuId: string,
    @Body() dto: UpdateOperatorUserDto,
  ): Promise<OperatorUserResponseDto> {
    return this.operatorsService.updateUser(id, usuId, dto);
  }

  @ApiBearerAuth('jwt')
  @ApiUnauthorizedResponse({
    description:
      'Requiere access JWT, sesion vigente y rol ADMIN validados por Identity.',
  })
  @Delete(':id/usuarios/:usuId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desasociar usuario de un operador',
    description: 'Elimina la asociación entre un usuario y un operador.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico del operador.' })
  @ApiParam({ name: 'usuId', description: 'ID del usuario (de ms_identity).' })
  @ApiNoContentResponse({ description: 'Asociación eliminada.' })
  @ApiNotFoundResponse({ description: 'Operador o asociación no encontrada.' })
  async removeUser(
    @Param('id') id: string,
    @Param('usuId') usuId: string,
  ): Promise<void> {
    return this.operatorsService.removeUser(id, usuId);
  }
}
