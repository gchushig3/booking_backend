import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { validateEnvironment } from '../../src/config/environment.js';
import { configureApplication } from '../../src/configure-application.js';
import { bootstrapAdmin } from '../../src/users/bootstrap-admin.js';
import {
  RolEntity,
  UsuarioEntity,
  UsuarioRolEntity,
} from '../../src/database/entities/index.js';
const env = validateEnvironment(process.env);
if (
  env.APP_ENV !== 'test' ||
  env.NODE_ENV !== 'test' ||
  env.DB_HOST !== '127.0.0.1' ||
  env.DB_PORT !== 5442 ||
  env.DB_DATABASE !== 'ms_identity_test'
)
  throw new Error('Isolated Identity test database required.');
process.env.BCRYPT_ROUNDS = '4';
process.env.JWT_KEYRING_PATH = '.keys/identity.test.json';
process.env.AUTH_LOGIN_LIMIT = '1000';
process.env.AUTH_RECOVERY_LIMIT = '1000';
const password = randomBytes(32).toString('base64url');
const prefix = `rbac-${randomUUID()}`;
const input = {
  enabled: 'true',
  email: `${prefix}-admin@example.test`,
  password,
  firstName: 'Local',
  lastName: 'Test',
};
let app: INestApplication<Server>;
let source: DataSource;
let adminId: string;
let adminToken: string;
let clientId: string;
let clientEmail: string;
let clientToken: string;
let adminRole: number;
let operatorRole: number;
const emails = new Set<string>();
const ids = new Set<string>();
const api = () => request(app.getHttpServer());
async function login(email: string) {
  return (
    await api().post('/api/v2/auth/login').send({ email, password }).expect(200)
  ).body.access_token as string;
}
async function register(suffix: string) {
  const email = `${prefix}-${suffix}@example.test`;
  emails.add(email);
  const result = await api()
    .post('/api/v2/auth/register')
    .send({ email, password, first_name: 'Prueba', last_name: 'Autorizacion' })
    .expect(201);
  ids.add(result.body.user.id as string);
  return { id: result.body.user.id as string, email };
}
describe('Phase E real RBAC and initial administrator', () => {
  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApplication(app);
    await app.init();
    source = app.get(DataSource);
    // Refuse a nonempty admin state rather than modifying someone else's fixture.
    const prior = await source.query(
      "SELECT count(*)::int AS n FROM usuario_rol ur JOIN rol r USING(rol_id) WHERE r.rol_nombre='ADMIN'",
    );
    if (prior[0].n !== 0)
      throw new Error(
        'RBAC suite needs no preexisting administrator in test DB.',
      );
    expect(await bootstrapAdmin(source, env, input)).toBe('created');
    const admin = await source.manager.findOneByOrFail(UsuarioEntity, {
      usu_correo: input.email,
    });
    adminId = admin.usu_id;
    ids.add(adminId);
    emails.add(input.email);
    adminRole = (
      await source.manager.findOneByOrFail(RolEntity, { rol_nombre: 'ADMIN' })
    ).rol_id;
    operatorRole = (
      await source.manager.findOneByOrFail(RolEntity, {
        rol_nombre: 'OPERADOR',
      })
    ).rol_id;
    adminToken = await login(input.email);
    const client = await register('client');
    clientId = client.id;
    clientEmail = client.email;
    clientToken = await login(clientEmail);
  });
  afterAll(async () => {
    if (source?.isInitialized && ids.size)
      await source.query('DELETE FROM usuario WHERE usu_id=ANY($1::bigint[])', [
        [...ids],
      ]);
    if (emails.size) {
      const list = (await (
        await fetch('http://127.0.0.1:8025/api/v1/messages?limit=1000')
      ).json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      const messages = list.messages
        .filter((m) => m.To.some((t) => emails.has(t.Address)))
        .map((m) => m.ID);
      if (messages.length)
        await fetch('http://127.0.0.1:8025/api/v1/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: messages }),
        });
    }
    await app?.close();
  });
  it('bootstrap is idempotent, hashes password, never promotes an existing client and rejects production/remote/disabled execution', async () => {
    const before = await source.manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .addSelect('u.usu_password')
      .where('u.usu_id=:id', { id: adminId })
      .getOneOrFail();
    expect(await bcrypt.compare(password, before.usu_password)).toBe(true);
    expect(await bootstrapAdmin(source, env, input)).toBe('unchanged');
    await expect(
      bootstrapAdmin(source, env, { ...input, email: clientEmail }),
    ).rejects.toThrow('cannot promote');
    await expect(
      bootstrapAdmin(source, env, {
        ...input,
        email: `${prefix}-second@example.test`,
      }),
    ).rejects.toThrow('already exists');
    await source.manager.update(
      UsuarioEntity,
      { usu_id: adminId },
      { usu_activo: false },
    );
    try {
      await expect(
        bootstrapAdmin(source, env, {
          ...input,
          email: `${prefix}-third@example.test`,
        }),
      ).rejects.toThrow('already exists');
      await expect(bootstrapAdmin(source, env, input)).rejects.toThrow(
        'cannot promote',
      );
    } finally {
      await source.manager.update(
        UsuarioEntity,
        { usu_id: adminId },
        { usu_activo: true },
      );
    }
    await expect(
      bootstrapAdmin(
        source,
        {
          ...env,
          APP_ENV: 'production',
          NODE_ENV: 'production',
          DB_DATABASE: 'ms_identity',
        },
        input,
      ),
    ).rejects.toThrow('disabled');
    await expect(
      bootstrapAdmin(source, { ...env, DB_HOST: 'remote.invalid' }, input),
    ).rejects.toThrow('disabled');
    await expect(
      bootstrapAdmin(source, env, { ...input, enabled: undefined }),
    ).rejects.toThrow('disabled');
    const after = await source.manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .addSelect('u.usu_password')
      .where('u.usu_id=:id', { id: adminId })
      .getOneOrFail();
    expect(after.usu_password).toBe(before.usu_password);
  });
  it('requires a JWT; CLIENTE receives 403 and ADMIN receives 200 on administrative endpoints', async () => {
    for (const path of [
      '/users',
      '/roles',
      `/users/${clientId}`,
      `/users/${clientId}/roles`,
    ]) {
      await api().get(`/api/v2${path}`).expect(401);
      await api()
        .get(`/api/v2${path}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
      await api()
        .get(`/api/v2${path}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    }
  });
  it('allows own profile while rejecting privilege fields and invalid DTOs', async () => {
    const result = await api()
      .get('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(result.body.id).toBe(clientId);
    const updated = await api()
      .patch('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        first_name: ' Updated ',
        phone: '+593999999999',
        birth_date: '2000-02-29',
        avatar_url: 'https://example.test/avatar.jpg',
      })
      .expect(200);
    expect(updated.body.first_name).toBe('Updated');
    expect(updated.body.roles).toEqual(['CLIENTE']);
    for (const body of [
      {},
      { first_name: null },
      { active: true },
      { roles: ['ADMIN'] },
      { email: 'other@example.test' },
      { birth_date: '2001-02-29' },
      { phone: 'bad' },
      { document: 'bad' },
      { avatar_url: 'file:///secret' },
    ])
      await api()
        .patch('/api/v2/users/me')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(body)
        .expect(400);
    await api()
      .patch('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ phone: null, birth_date: null, avatar_url: null })
      .expect(200);
    await api()
      .patch(`/api/v2/users/${adminId}/status`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ active: false })
      .expect(403);
    await api()
      .post(`/api/v2/users/${clientId}/roles`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ role_id: adminRole })
      .expect(403);
  });
  it('an inactive ADMIN role grants no access even with an unexpired ADMIN token', async () => {
    await source.manager.update(
      RolEntity,
      { rol_id: adminRole },
      { rol_activo: false },
    );
    try {
      await api()
        .get('/api/v2/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
      await api()
        .post('/api/v2/auth/login')
        .send({ email: input.email, password })
        .expect(401);
    } finally {
      await source.manager.update(
        RolEntity,
        { rol_id: adminRole },
        { rol_activo: true },
      );
    }
  });
  it('paginates safely, preserves BIGINT strings and rejects invalid IDs/limits', async () => {
    const result = await api()
      .get('/api/v2/users?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(result.body.items).toHaveLength(1);
    expect(typeof result.body.items[0].id).toBe('string');
    expect(result.body.total).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(result.body)).not.toMatch(
      /usu_password|ses_token_hash/,
    );
    for (const path of [
      '/users?page=0',
      '/users?limit=101',
      '/users?unknown=true',
      '/users/9223372036854775808',
      '/users/1e3',
      `/users/${clientId}/roles/99999999999`,
    ]) {
      if (path.includes('/roles/'))
        await api()
          .delete(`/api/v2${path}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      else
        await api()
          .get(`/api/v2${path}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
    }
    await api()
      .get('/api/v2/users/9223372036854775807')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
  it('returns 409 for duplicate documents without exposing SQL', async () => {
    const other = await register('document');
    const token = await login(other.email);
    await api()
      .patch('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ document: 'AB12345678' })
      .expect(200);
    const result = await api()
      .patch('/api/v2/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ document: 'AB12345678' })
      .expect(409);
    expect(result.body.detail).toBe('Document already assigned.');
  });
  it('assigns roles with assigner audit, revokes old sessions and forbids self role changes', async () => {
    await api()
      .post(`/api/v2/users/${adminId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: adminRole })
      .expect(403);
    await api()
      .delete(`/api/v2/users/${adminId}/roles/${adminRole}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
    const result = await api()
      .post(`/api/v2/users/${clientId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: operatorRole })
      .expect(201);
    expect(result.body.assigned_by).toBe(adminId);
    await api()
      .get('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(401);
    clientToken = await login(clientEmail);
    await api()
      .get('/api/v2/roles')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
    await api()
      .post(`/api/v2/users/${clientId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: operatorRole })
      .expect(409);
    await api()
      .delete(`/api/v2/users/${clientId}/roles/${operatorRole}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await api()
      .get('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(401);
    clientToken = await login(clientEmail);
  });
  it('rejects inactive roles and rolls back the assignment', async () => {
    await source.manager.update(
      RolEntity,
      { rol_id: operatorRole },
      { rol_activo: false },
    );
    try {
      await api()
        .post(`/api/v2/users/${clientId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role_id: operatorRole })
        .expect(409);
    } finally {
      await source.manager.update(
        RolEntity,
        { rol_id: operatorRole },
        { rol_activo: true },
      );
    }
    expect(
      await source.manager.existsBy(UsuarioRolEntity, {
        usu_id: clientId,
        rol_id: operatorRole,
      }),
    ).toBe(false);
  });
  it('deactivates users and revokes sessions, rejects self-deactivation and does not revive old sessions', async () => {
    await api()
      .patch(`/api/v2/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(409);
    await api()
      .patch(`/api/v2/users/${clientId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(200);
    await api()
      .get('/api/v2/auth/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(401);
    await api()
      .post('/api/v2/auth/login')
      .send({ email: clientEmail, password })
      .expect(401);
    await api()
      .patch(`/api/v2/users/${clientId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: true })
      .expect(200);
    await api()
      .get('/api/v2/auth/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(401);
    clientToken = await login(clientEmail);
  });
  it('does not trust stale ADMIN claims after the role is removed', async () => {
    const other = await register('admin-demotion');
    await api()
      .post(`/api/v2/users/${other.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: adminRole })
      .expect(201);
    const token = await login(other.email);
    await api()
      .get('/api/v2/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await api()
      .delete(`/api/v2/users/${other.id}/roles/${adminRole}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await api()
      .get('/api/v2/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const demotedToken = await login(other.email);
    await api()
      .get('/api/v2/roles')
      .set('Authorization', `Bearer ${demotedToken}`)
      .expect(403);
  });
  it('serializes concurrent cross-demotion and keeps an active administrator', async () => {
    const other = await register('admin-concurrent');
    await api()
      .post(`/api/v2/users/${other.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role_id: adminRole })
      .expect(201);
    const token = await login(other.email);
    const responses = await Promise.all([
      api()
        .delete(`/api/v2/users/${other.id}/roles/${adminRole}`)
        .set('Authorization', `Bearer ${adminToken}`),
      api()
        .delete(`/api/v2/users/${adminId}/roles/${adminRole}`)
        .set('Authorization', `Bearer ${token}`),
    ]);
    expect(responses.filter((r) => r.status === 204)).toHaveLength(1);
    expect(responses.some((r) => r.status === 401 || r.status === 403)).toBe(
      true,
    );
    const admins = await source.query(
      "SELECT count(*)::int AS n FROM usuario_rol ur JOIN usuario u USING(usu_id) JOIN rol r USING(rol_id) WHERE u.usu_activo AND r.rol_activo AND r.rol_nombre='ADMIN'",
    );
    expect(admins[0].n).toBe(1);
  });
});
