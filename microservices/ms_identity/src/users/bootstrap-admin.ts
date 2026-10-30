import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import type { IdentityEnvironment } from '../config/environment.js';
import { RegisterDto } from '../auth/auth.dto.js';
import {
  RolEntity,
  UsuarioEntity,
  UsuarioRolEntity,
} from '../database/entities/index.js';
import { lockAdministration } from './authorization.js';
export interface BootstrapInput {
  enabled: string | undefined;
  email: string | undefined;
  password: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
}
export async function bootstrapAdmin(
  source: DataSource,
  env: IdentityEnvironment,
  input: BootstrapInput,
): Promise<'created' | 'unchanged'> {
  // Test is allowed only on the isolated database, never as a production bypass.
  const local = env.APP_ENV === 'local' && env.DB_DATABASE === 'ms_identity';
  const test =
    env.APP_ENV === 'test' &&
    env.NODE_ENV === 'test' &&
    env.DB_DATABASE === 'ms_identity_test';
  if (
    (!local && !test) ||
    !['127.0.0.1', 'localhost'].includes(env.DB_HOST) ||
    input.enabled !== 'true'
  )
    throw new Error(
      'Bootstrap is disabled outside explicitly authorized local/test targets.',
    );
  const dto = plainToInstance(RegisterDto, {
    email: input.email,
    password: input.password,
    first_name: input.firstName,
    last_name: input.lastName,
  });
  if (
    (await validate(dto)).length ||
    Buffer.byteLength(dto.password, 'utf8') < 32
  )
    throw new Error(
      'Invalid bootstrap input; use locally generated random credentials.',
    );
  const hash = await bcrypt.hash(dto.password, 12);
  return source.transaction(async (manager) => {
    await lockAdministration(manager);
    // Share email lock with public registration: never turn a concurrent CLIENTE into ADMIN.
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [dto.email],
    );
    const [target] = await manager.query<
      Array<{ database: string; version: string }>
    >(
      "SELECT current_database() AS database,current_setting('server_version_num') AS version",
    );
    if (
      target?.database !== env.DB_DATABASE ||
      !target.version.startsWith('16')
    )
      throw new Error('Unexpected bootstrap database.');
    const role = await manager.findOneBy(RolEntity, {
      rol_nombre: 'ADMIN',
      rol_activo: true,
    });
    if (!role) throw new Error('Active ADMIN seed required.');
    const existing = await manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .where('lower(u.usu_correo)=:email', { email: dto.email })
      .getOne();
    if (existing) {
      if (
        existing.usu_activo &&
        (await manager.existsBy(UsuarioRolEntity, {
          usu_id: existing.usu_id,
          rol_id: role.rol_id,
        }))
      )
        return 'unchanged';
      throw new Error(
        'Bootstrap cannot promote or reactivate an existing account.',
      );
    }
    if (await manager.existsBy(UsuarioRolEntity, { rol_id: role.rol_id }))
      throw new Error(
        'Initial administrator already exists; use the authenticated roles API.',
      );
    const user = await manager.save(
      UsuarioEntity,
      manager.create(UsuarioEntity, {
        usu_correo: dto.email,
        usu_password: hash,
        usu_nombre: dto.first_name,
        usu_apellido: dto.last_name,
      }),
    );
    await manager.insert(UsuarioRolEntity, {
      usu_id: user.usu_id,
      rol_id: role.rol_id,
      usr_asignado_por: null,
    });
    return 'created';
  });
}
