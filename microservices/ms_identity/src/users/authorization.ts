import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Principal } from '../auth/auth.decorators.js';
import {
  RolEntity,
  UsuarioEntity,
  UsuarioRolEntity,
  SesionEntity,
} from '../database/entities/index.js';
// Same transaction lock is shared by every administrative write and bootstrap.
export async function lockAdministration(
  manager: EntityManager,
): Promise<void> {
  await manager.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('identity:administration',0))",
  );
}
export async function activeAdminCount(
  manager: EntityManager,
): Promise<number> {
  return manager
    .createQueryBuilder(UsuarioRolEntity, 'ur')
    .innerJoin(UsuarioEntity, 'u', 'u.usu_id=ur.usu_id AND u.usu_activo=true')
    .innerJoin(
      RolEntity,
      'r',
      "r.rol_id=ur.rol_id AND r.rol_activo=true AND r.rol_nombre='ADMIN'",
    )
    .getCount();
}
export async function assertAdmin(
  manager: EntityManager,
  principal: Principal,
): Promise<void> {
  const user = await manager.findOneBy(UsuarioEntity, {
    usu_id: principal.userId,
    usu_activo: true,
  });
  const session = await manager.findOneBy(SesionEntity, {
    ses_id: principal.sessionId,
    usu_id: principal.userId,
    ses_revocada: false,
  });
  if (!user || !session || session.ses_expira_en.getTime() <= Date.now())
    throw new UnauthorizedException('Invalid or expired credentials.');
  const granted = await manager
    .createQueryBuilder(UsuarioRolEntity, 'ur')
    .innerJoin(
      RolEntity,
      'r',
      "r.rol_id=ur.rol_id AND r.rol_activo=true AND r.rol_nombre='ADMIN'",
    )
    .where('ur.usu_id=:id', { id: principal.userId })
    .getExists();
  if (!granted) throw new ForbiddenException('Insufficient permissions.');
}
