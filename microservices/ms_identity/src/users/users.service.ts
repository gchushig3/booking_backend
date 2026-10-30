import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  UsuarioEntity,
  RolEntity,
  UsuarioRolEntity,
  SesionEntity,
  TokenVerificacionEntity,
} from '../database/entities/index.js';
import { publicUser } from '../auth/auth.service.js';
import type { Principal } from '../auth/auth.decorators.js';
import type { ProfileDto, PaginationDto } from './users.dto.js';
import {
  activeAdminCount,
  assertAdmin,
  lockAdministration,
} from './authorization.js';
const roleResponse = (r: RolEntity) => ({
  id: r.rol_id,
  name: r.rol_nombre,
  description: r.rol_descripcion,
  active: r.rol_activo,
});
@Injectable()
export class UsersService {
  constructor(private readonly source: DataSource) {}
  private async user(manager: EntityManager, id: string) {
    const user = await manager.findOneBy(UsuarioEntity, { usu_id: id });
    if (!user) throw new NotFoundException('User not found.');
    const rows = await manager
      .createQueryBuilder(UsuarioRolEntity, 'ur')
      .innerJoin(RolEntity, 'r', 'r.rol_id=ur.rol_id AND r.rol_activo=true')
      .select('r.rol_nombre', 'name')
      .where('ur.usu_id=:id', { id })
      .orderBy('r.rol_id')
      .getRawMany<{ name: string }>();
    return publicUser(
      user,
      rows.map((r) => r.name),
    );
  }
  me(principal: Principal) {
    return this.user(this.source.manager, principal.userId);
  }
  get(id: string) {
    return this.user(this.source.manager, id);
  }
  async list(query: PaginationDto) {
    const [users, total] = await this.source.manager.findAndCount(
      UsuarioEntity,
      {
        order: { usu_id: 'ASC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      },
    );
    return {
      items: await Promise.all(
        users.map((u) => this.user(this.source.manager, u.usu_id)),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  async profile(principal: Principal, dto: ProfileDto) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('At least one profile field is required.');
    const patch: Partial<UsuarioEntity> = {};
    if (dto.first_name !== undefined) patch.usu_nombre = dto.first_name;
    if (dto.last_name !== undefined) patch.usu_apellido = dto.last_name;
    if (dto.document !== undefined) patch.usu_documento = dto.document;
    if (dto.phone !== undefined) patch.usu_telefono = dto.phone;
    if (dto.birth_date !== undefined)
      patch.usu_fecha_nacimiento = dto.birth_date;
    if (dto.avatar_url !== undefined) patch.usu_avatar = dto.avatar_url;
    try {
      return await this.source.transaction(async (manager) => {
        const user = await manager
          .createQueryBuilder(UsuarioEntity, 'u')
          .where('u.usu_id=:id', { id: principal.userId })
          .setLock('pessimistic_write')
          .getOne();
        if (!user?.usu_activo)
          throw new ForbiddenException('User unavailable.');
        await manager.update(
          UsuarioEntity,
          { usu_id: principal.userId },
          patch,
        );
        return this.user(manager, principal.userId);
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'driverError' in error &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('Document already assigned.');
      throw error;
    }
  }
  async status(principal: Principal, id: string, active: boolean) {
    return this.source.transaction(async (manager) => {
      await lockAdministration(manager);
      await assertAdmin(manager, principal);
      if (id === principal.userId && !active)
        throw new ConflictException(
          'Cannot deactivate the current administrator.',
        );
      const user = await manager
        .createQueryBuilder(UsuarioEntity, 'u')
        .where('u.usu_id=:id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new NotFoundException('User not found.');
      await manager.update(
        UsuarioEntity,
        { usu_id: id },
        { usu_activo: active },
      );
      if ((await activeAdminCount(manager)) < 1)
        throw new ConflictException(
          'At least one active administrator is required.',
        );
      if (!active) {
        await manager.update(
          SesionEntity,
          { usu_id: id },
          { ses_revocada: true },
        );
        await manager.update(
          TokenVerificacionEntity,
          { usu_id: id, tokv_usado: false },
          { tokv_usado: true },
        );
      }
      return this.user(manager, id);
    });
  }
  async roles() {
    return (
      await this.source.manager.find(RolEntity, { order: { rol_id: 'ASC' } })
    ).map(roleResponse);
  }
  async assignments(id: string, manager = this.source.manager) {
    if (!(await manager.existsBy(UsuarioEntity, { usu_id: id })))
      throw new NotFoundException('User not found.');
    const rows = await manager.find(UsuarioRolEntity, {
      where: { usu_id: id },
      relations: { rol: true },
      order: { rol_id: 'ASC' },
    });
    return rows.map((row) => ({
      ...roleResponse(row.rol),
      assigned_at: row.usr_asignado_en,
      assigned_by: row.usr_asignado_por,
    }));
  }
  async assign(principal: Principal, id: string, roleId: number) {
    return this.source.transaction(async (manager) => {
      await lockAdministration(manager);
      await assertAdmin(manager, principal);
      if (id === principal.userId)
        throw new ForbiddenException('Cannot edit own roles.');
      const user = await manager
        .createQueryBuilder(UsuarioEntity, 'u')
        .where('u.usu_id=:id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new NotFoundException('User not found.');
      const role = await manager.findOneBy(RolEntity, { rol_id: roleId });
      if (!role) throw new NotFoundException('Role not found.');
      if (!role.rol_activo)
        throw new ConflictException('Cannot assign an inactive role.');
      if (
        await manager.existsBy(UsuarioRolEntity, { usu_id: id, rol_id: roleId })
      )
        throw new ConflictException('Role already assigned.');
      await manager.insert(UsuarioRolEntity, {
        usu_id: id,
        rol_id: roleId,
        usr_asignado_por: principal.userId,
      });
      await manager.update(
        SesionEntity,
        { usu_id: id },
        { ses_revocada: true },
      );
      return (await this.assignments(id, manager)).find(
        (r) => r.id === roleId,
      )!;
    });
  }
  async remove(
    principal: Principal,
    id: string,
    roleId: number,
  ): Promise<void> {
    await this.source.transaction(async (manager) => {
      await lockAdministration(manager);
      await assertAdmin(manager, principal);
      if (id === principal.userId)
        throw new ForbiddenException('Cannot edit own roles.');
      const user = await manager
        .createQueryBuilder(UsuarioEntity, 'u')
        .where('u.usu_id=:id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new NotFoundException('User not found.');
      const deleted = await manager.delete(UsuarioRolEntity, {
        usu_id: id,
        rol_id: roleId,
      });
      if (!deleted.affected)
        throw new NotFoundException('Role assignment not found.');
      if ((await activeAdminCount(manager)) < 1)
        throw new ConflictException(
          'At least one active administrator is required.',
        );
      await manager.update(
        SesionEntity,
        { usu_id: id },
        { ses_revocada: true },
      );
    });
  }
}
