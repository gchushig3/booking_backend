import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal, Roles } from '../auth/auth.decorators.js';
import type { Principal } from '../auth/auth.decorators.js';
import { UsersService } from './users.service.js';
import {
  ProfileDto,
  PaginationDto,
  StatusDto,
  AssignRoleDto,
} from './users.dto.js';
import { IdentityIdPipe, RoleIdPipe } from './identity-id.pipe.js';
import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint, ApiUserId, ApiRoleId } from '../openapi/endpoint.js';
import {
  UserResponse,
  UsersPageResponse,
  AssignmentResponse,
  RoleResponse,
} from '../openapi/responses.js';
@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @ApiEndpoint({
    summary: 'Consultar perfil propio',
    access: 'authenticated',
    type: UserResponse,
  })
  @Get('me')
  me(@CurrentPrincipal() p: Principal) {
    return this.users.me(p);
  }
  @ApiEndpoint({
    summary: 'Actualizar perfil propio',
    access: 'authenticated',
    type: UserResponse,
    errors: [400, 409],
    description:
      'Al menos un campo editable. No admite email, password, roles, active ni verified. Opcionales SQL aceptan null. Documento duplicado: 409.',
  })
  @Patch('me')
  profile(@CurrentPrincipal() p: Principal, @Body() dto: ProfileDto) {
    return this.users.profile(p, dto);
  }
  @ApiEndpoint({
    summary: 'Listar usuarios con paginación',
    access: 'ADMIN',
    type: UsersPageResponse,
    errors: [400],
    description:
      'Orden por ID ascendente; incluye usuarios inactivos y solo roles actualmente activos.',
  })
  @Roles('ADMIN')
  @Get()
  list(@Query() dto: PaginationDto) {
    return this.users.list(dto);
  }
  @ApiUserId()
  @ApiEndpoint({
    summary: 'Consultar un usuario',
    access: 'ADMIN',
    type: UserResponse,
    errors: [400, 404],
  })
  @Roles('ADMIN')
  @Get(':id')
  get(@Param('id', IdentityIdPipe) id: string) {
    return this.users.get(id);
  }
  @ApiUserId()
  @ApiEndpoint({
    summary: 'Cambiar estado de un usuario',
    access: 'ADMIN',
    type: UserResponse,
    errors: [400, 404, 409],
    description:
      'Desactivar revoca todas sus sesiones y tokens pendientes. Reactivar no revive sesiones. Auto-desactivación y pérdida del último ADMIN activo: 409.',
  })
  @Roles('ADMIN')
  @Patch(':id/status')
  status(
    @CurrentPrincipal() p: Principal,
    @Param('id', IdentityIdPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    return this.users.status(p, id, dto.active);
  }
  @ApiUserId()
  @ApiEndpoint({
    summary: 'Listar asignaciones de roles',
    access: 'ADMIN',
    type: AssignmentResponse,
    array: true,
    errors: [400, 404],
    description:
      'Incluye asignaciones de roles inactivos, sin conceder permisos por ellos.',
  })
  @Roles('ADMIN')
  @Get(':id/roles')
  assignments(@Param('id', IdentityIdPipe) id: string) {
    return this.users.assignments(id);
  }
  @ApiUserId()
  @ApiEndpoint({
    summary: 'Asignar un rol a otro usuario',
    access: 'ADMIN',
    status: 201,
    type: AssignmentResponse,
    errors: [400, 404, 409],
    description:
      'Editar roles propios: 403. Rol duplicado/inactivo: 409. Conserva asignador/fecha y revoca sesiones afectadas; nuevo login requerido.',
  })
  @Roles('ADMIN')
  @Post(':id/roles')
  assign(
    @CurrentPrincipal() p: Principal,
    @Param('id', IdentityIdPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.users.assign(p, id, dto.role_id);
  }
  @ApiUserId()
  @ApiRoleId()
  @ApiEndpoint({
    summary: 'Retirar un rol de otro usuario',
    access: 'ADMIN',
    status: 204,
    errors: [400, 404, 409],
    description:
      'Editar roles propios: 403; último ADMIN activo: 409. Revoca sesiones afectadas; no puede asignarse ADMIN mediante el perfil.',
  })
  @Roles('ADMIN')
  @Delete(':id/roles/:roleId')
  @HttpCode(204)
  remove(
    @CurrentPrincipal() p: Principal,
    @Param('id', IdentityIdPipe) id: string,
    @Param('roleId', RoleIdPipe) roleId: number,
  ) {
    return this.users.remove(p, id, roleId);
  }
}
@Roles('ADMIN')
@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly users: UsersService) {}
  @ApiEndpoint({
    summary: 'Listar roles',
    access: 'ADMIN',
    type: RoleResponse,
    array: true,
    description:
      'Incluye ADMIN, OPERADOR y CLIENTE sembrados por SQL y su estado actual. Roles inactivos no conceden permisos.',
  })
  @Get()
  list() {
    return this.users.roles();
  }
}
