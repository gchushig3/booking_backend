import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { SignJWT, importJWK, createLocalJWKSet, jwtVerify } from 'jose';
import { configureApplication } from '../../src/configure-application.js';
import { validateEnvironment } from '../../src/config/environment.js';
import {
  UsuarioEntity,
  SesionEntity,
  TokenVerificacionEntity,
} from '../../src/database/entities/index.js';
import { tokenHash } from '../../src/auth/auth.service.js';

const env = validateEnvironment(process.env);
if (
  env.APP_ENV !== 'test' ||
  env.NODE_ENV !== 'test' ||
  env.DB_DATABASE !== 'ms_identity_test' ||
  env.DB_HOST !== '127.0.0.1' ||
  env.DB_PORT !== 5442
)
  throw new Error(
    'Auth integration requires isolated loopback PostgreSQL test database.',
  );
process.env.BCRYPT_ROUNDS = '4';
process.env.JWT_KEYRING_PATH = '.keys/identity.test.json';
process.env.AUTH_LOGIN_LIMIT = '1000';
process.env.AUTH_RECOVERY_LIMIT = '1000';
const password = 'Identity-test-password-42!';
interface Pair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
interface Account {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}
interface Mail {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
}
const mailIds = new Set<string>();
const emails = new Set<string>();
const users: string[] = [];
let app: INestApplication<Server>;
let source: DataSource;
const mailUrl = 'http://127.0.0.1:8025';
async function start() {
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
}
async function register(): Promise<Account> {
  const data = {
    email: `identity-${randomUUID()}@example.test`,
    password,
    first_name: 'Prueba',
    last_name: 'Identity',
  };
  const response = await request(app.getHttpServer())
    .post('/api/v2/auth/register')
    .send(data)
    .expect(201);
  const id = response.body.user.id as string;
  emails.add(data.email);
  users.push(id);
  expect(response.body.verification_email_sent).toBe(true);
  expect(response.body.user).toMatchObject({
    id,
    email: data.email,
    verified: false,
    roles: ['CLIENTE'],
  });
  expect(JSON.stringify(response.body)).not.toContain('usu_password');
  return { ...data, id };
}
async function login(user: Account, secret = user.password): Promise<Pair> {
  const result = await request(app.getHttpServer())
    .post('/api/v2/auth/login')
    .send({ email: user.email, password: secret })
    .expect(200);
  expect(result.headers['cache-control']).toBe('no-store');
  return result.body as Pair;
}
async function mailToken(
  user: Account,
  purpose: 'EMAIL' | 'RECUPERACION',
): Promise<string> {
  const response = await fetch(`${mailUrl}/api/v1/messages?limit=1000`);
  if (!response.ok) throw new Error('Mailpit unavailable');
  const list = (await response.json()) as { messages: Mail[] };
  const messages = list.messages.filter((m) =>
    m.To.some((to) => to.Address === user.email),
  );
  for (const item of messages) mailIds.add(item.ID);
  const mail = messages.find((m) =>
    m.Subject.includes(
      purpose === 'EMAIL' ? 'Email verification' : 'Password recovery',
    ),
  );
  if (!mail) throw new Error('Expected actual SMTP delivery');
  const detail = (await (
    await fetch(`${mailUrl}/api/v1/message/${mail.ID}`)
  ).json()) as { Text: string };
  const token = /Token: ([A-Za-z0-9_-]{43})/.exec(detail.Text)?.[1];
  if (!token) throw new Error('Missing mail token');
  return token;
}
const me = (token: string) =>
  request(app.getHttpServer())
    .get('/api/v2/auth/me')
    .set('Authorization', `Bearer ${token}`);

describe('Phase D real authentication: PostgreSQL + Mailpit + RS256', () => {
  beforeAll(start);
  afterAll(async () => {
    if (source?.isInitialized && users.length)
      await source.query(
        'DELETE FROM usuario WHERE usu_id = ANY($1::bigint[])',
        [users],
      );
    // Remove only messages addressed to this suite, including unconsumed registration messages.
    if (users.length) {
      const list = (await (
        await fetch(`${mailUrl}/api/v1/messages?limit=1000`)
      ).json()) as { messages: Mail[] };
      for (const item of list.messages)
        if (item.To.some((to) => emails.has(to.Address))) mailIds.add(item.ID);
      if (mailIds.size)
        await fetch(`${mailUrl}/api/v1/messages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: [...mailIds] }),
        });
    }
    await app?.close();
  });
  it('registers without JWT, hashes with bcrypt and assigns only CLIENTE; duplicate is 409', async () => {
    const user = await register();
    const stored = await source.manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .addSelect('u.usu_password')
      .where('u.usu_id = :id', { id: user.id })
      .getOneOrFail();
    expect(await bcrypt.compare(password, stored.usu_password)).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({ ...user, id: undefined })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({
        ...user,
        email: `other-${randomUUID()}@example.test`,
        id: undefined,
        roles: ['ADMIN'],
      })
      .expect(400);
  });
  it('public login works, unknown/wrong credentials are generic, protected routes require valid access', async () => {
    const user = await register();
    const tokens = await login(user);
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(900);
    await request(app.getHttpServer()).get('/api/v2/auth/me').expect(401);
    await me('invalid').expect(401);
    await me(tokens.refresh_token).expect(401);
    const result = await me(tokens.access_token).expect(200);
    expect(result.body.user).toMatchObject({
      id: user.id,
      verified: false,
      roles: ['CLIENTE'],
    });
    const wrong = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: user.email, password: 'wrong-secret' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: 'unknown@example.test', password: 'wrong-secret' })
      .expect(401);
    expect(wrong.body.detail).toBe(unknown.body.detail);
    expect(wrong.headers['content-type']).toContain('application/problem+json');
    expect(wrong.body.correlation_id).toBeTruthy();
  });
  it('publishes only public keys and verifies tokens offline with exact issuer/audience and string BIGINT', async () => {
    const user = await register();
    const tokens = await login(user);
    const response = await request(app.getHttpServer())
      .get('/api/v2/.well-known/jwks.json')
      .expect(200);
    expect(response.body.keys.length).toBeGreaterThan(0);
    for (const key of response.body.keys) {
      expect(key.d).toBeUndefined();
      expect(key.p).toBeUndefined();
      expect(key.kty).toBe('RSA');
    }
    const verified = await jwtVerify(
      tokens.access_token,
      createLocalJWKSet(response.body),
      {
        algorithms: ['RS256'],
        issuer: 'urn:descubreec:identity',
        audience: 'urn:descubreec:internal-api',
        typ: 'identity-access+jwt',
      },
    );
    expect(verified.payload.sub).toBe(user.id);
    expect(verified.payload.roles).toEqual(['CLIENTE']);
  });
  it('rotates refresh hashes; signed replay revokes the session including its latest access token', async () => {
    const user = await register();
    const initial = await login(user);
    const refreshed = await request(app.getHttpServer())
      .post('/api/v2/auth/refresh')
      .send({ refresh_token: initial.refresh_token })
      .expect(200);
    expect(refreshed.body.refresh_token).not.toBe(initial.refresh_token);
    const session = await source.manager
      .createQueryBuilder(SesionEntity, 's')
      .addSelect('s.ses_token_hash')
      .where('s.usu_id=:id', { id: user.id })
      .getOneOrFail();
    expect(session.ses_token_hash).toBe(
      tokenHash(refreshed.body.refresh_token),
    );
    await me(refreshed.body.access_token).expect(200);
    await request(app.getHttpServer())
      .post('/api/v2/auth/refresh')
      .send({ refresh_token: initial.refresh_token })
      .expect(401);
    await me(refreshed.body.access_token).expect(401);
  });
  it('serializes concurrent refresh and commits replay revocation', async () => {
    const user = await register();
    const tokens = await login(user);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/v2/auth/refresh')
          .send({ refresh_token: tokens.refresh_token }),
      ),
    );
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 401,
    ]);
    const winner = responses.find((r) => r.status === 200)!;
    await me(winner.body.access_token).expect(401);
  });
  it('rejects expired signed tokens, wrong audience and inactive users and roles', async () => {
    const user = await register();
    const tokens = await login(user);
    const claims = JSON.parse(
      Buffer.from(tokens.access_token.split('.')[1]!, 'base64url').toString(),
    ) as { sid: string };
    const ring = JSON.parse(await readFile('.keys/identity.test.json', 'utf8'));
    const key = await importJWK(
      ring.keys.find((k: { kid: string }) => k.kid === ring.activeKid)
        .privateJwk,
      'RS256',
    );
    const signed = async (audience: string, expiration: number) =>
      new SignJWT({ sid: claims.sid, roles: ['CLIENTE'], token_use: 'access' })
        .setProtectedHeader({
          alg: 'RS256',
          typ: 'identity-access+jwt',
          kid: ring.activeKid,
        })
        .setSubject(user.id)
        .setIssuer('urn:descubreec:identity')
        .setAudience(audience)
        .setJti(randomUUID())
        .setIssuedAt(Math.floor(Date.now() / 1000) - 10)
        .setExpirationTime(expiration)
        .sign(key);
    await me(
      await signed(
        'urn:descubreec:internal-api',
        Math.floor(Date.now() / 1000) - 1,
      ),
    ).expect(401);
    await me(
      await signed('wrong-audience', Math.floor(Date.now() / 1000) + 60),
    ).expect(401);
    await source.manager.update(
      UsuarioEntity,
      { usu_id: user.id },
      { usu_activo: false },
    );
    await me(tokens.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: user.email, password })
      .expect(401);
    await source.manager.update(
      UsuarioEntity,
      { usu_id: user.id },
      { usu_activo: true },
    );
    await source.query(
      "UPDATE rol SET rol_activo=false WHERE rol_nombre='CLIENTE'",
    );
    try {
      await me(tokens.access_token).expect(403);
      await request(app.getHttpServer())
        .post('/api/v2/auth/login')
        .send({ email: user.email, password })
        .expect(401);
    } finally {
      await source.query(
        "UPDATE rol SET rol_activo=true WHERE rol_nombre='CLIENTE'",
      );
    }
  });
  it('lists only owned sessions, rejects foreign session revocation and logout revokes access', async () => {
    const user = await register();
    const other = await register();
    const first = await login(user);
    const second = await login(user);
    const foreign = await login(other);
    const sessions = await request(app.getHttpServer())
      .get('/api/v2/auth/sessions')
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(200);
    expect(sessions.body).toHaveLength(2);
    expect(JSON.stringify(sessions.body)).not.toContain('hash');
    const foreignSession = (await me(foreign.access_token)).body
      .session_id as string;
    await request(app.getHttpServer())
      .delete(`/api/v2/auth/sessions/${foreignSession}`)
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(404);
    const sid = (await me(second.access_token)).body.session_id as string;
    await request(app.getHttpServer())
      .delete(`/api/v2/auth/sessions/${sid}`)
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(204);
    await me(second.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/logout')
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(204);
    await me(first.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/refresh')
      .send({ refresh_token: first.refresh_token })
      .expect(401);
  });
  it('logout-all revokes every session', async () => {
    const user = await register();
    const first = await login(user);
    const second = await login(user);
    await request(app.getHttpServer())
      .post('/api/v2/auth/logout-all')
      .set('Authorization', `Bearer ${first.access_token}`)
      .expect(204);
    await me(first.access_token).expect(401);
    await me(second.access_token).expect(401);
  });
  it('delivers real email, stores only SHA256 and verifies once', async () => {
    const user = await register();
    const token = await mailToken(user, 'EMAIL');
    const record = await source.manager
      .createQueryBuilder(TokenVerificacionEntity, 't')
      .addSelect('t.tokv_token')
      .where('t.usu_id=:id', { id: user.id })
      .getOneOrFail();
    expect(record.tokv_token).toBe(tokenHash(token));
    await request(app.getHttpServer())
      .post('/api/v2/auth/verify-email')
      .send({ token })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v2/auth/verify-email')
      .send({ token })
      .expect(400);
    expect(
      (await source.manager.findOneByOrFail(UsuarioEntity, { usu_id: user.id }))
        .usu_verificado,
    ).toBe(true);
  });
  it('resending invalidates previous verification; expired and wrong-purpose tokens fail', async () => {
    const user = await register();
    const old = await mailToken(user, 'EMAIL');
    await request(app.getHttpServer())
      .post('/api/v2/auth/resend-verification')
      .send({ email: user.email })
      .expect(200);
    const next = await mailToken(user, 'EMAIL');
    expect(next).not.toBe(old);
    await request(app.getHttpServer())
      .post('/api/v2/auth/verify-email')
      .send({ token: old })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/auth/reset-password')
      .send({ token: next, new_password: 'Different-password-42!' })
      .expect(400);
    await source.manager.update(
      TokenVerificacionEntity,
      { usu_id: user.id, tokv_usado: false },
      { tokv_expira_en: new Date(Date.now() - 1000) },
    );
    await request(app.getHttpServer())
      .post('/api/v2/auth/verify-email')
      .send({ token: next })
      .expect(400);
  });
  it('password recovery is generic, single-use, revokes sessions and changes the actual bcrypt password', async () => {
    const user = await register();
    const tokens = await login(user);
    const known = await request(app.getHttpServer())
      .post('/api/v2/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    const unknown = await request(app.getHttpServer())
      .post('/api/v2/auth/forgot-password')
      .send({ email: 'unknown@example.test' })
      .expect(200);
    expect(known.body).toEqual(unknown.body);
    const token = await mailToken(user, 'RECUPERACION');
    const next = 'Recovered-password-42!';
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/v2/auth/reset-password')
          .send({ token, new_password: next }),
      ),
    );
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      204, 400,
    ]);
    await me(tokens.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: user.email, password })
      .expect(401);
    await login(user, next);
  });
  it('change-password rejects wrong current credentials, revokes all sessions and pending reset', async () => {
    const user = await register();
    const first = await login(user);
    const second = await login(user);
    await request(app.getHttpServer())
      .post('/api/v2/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    const token = await mailToken(user, 'RECUPERACION');
    await request(app.getHttpServer())
      .patch('/api/v2/auth/change-password')
      .set('Authorization', `Bearer ${first.access_token}`)
      .send({
        current_password: 'wrong-password',
        new_password: 'Changed-password-42!',
      })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/v2/auth/change-password')
      .set('Authorization', `Bearer ${first.access_token}`)
      .send({
        current_password: password,
        new_password: 'Changed-password-42!',
      })
      .expect(204);
    await me(first.access_token).expect(401);
    await me(second.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/reset-password')
      .send({ token, new_password: 'Another-password-42!' })
      .expect(400);
    await login(user, 'Changed-password-42!');
  });
  it('rejects expired sessions even when the signed token has not expired', async () => {
    const user = await register();
    const tokens = await login(user);
    await source.manager.update(
      SesionEntity,
      { usu_id: user.id },
      { ses_expira_en: new Date(Date.now() - 1000) },
    );
    await me(tokens.access_token).expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/auth/refresh')
      .send({ refresh_token: tokens.refresh_token })
      .expect(401);
  });
  it('rejects expired recovery tokens and replaced recovery tokens without changing the password', async () => {
    const user = await register();
    await request(app.getHttpServer())
      .post('/api/v2/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    const previous = await mailToken(user, 'RECUPERACION');
    await request(app.getHttpServer())
      .post('/api/v2/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);
    const current = await mailToken(user, 'RECUPERACION');
    expect(current).not.toBe(previous);
    await request(app.getHttpServer())
      .post('/api/v2/auth/reset-password')
      .send({ token: previous, new_password: 'A-different-password-42!' })
      .expect(400);
    await source.manager.update(
      TokenVerificacionEntity,
      { usu_id: user.id, tokv_tipo: 'RECUPERACION', tokv_usado: false },
      { tokv_expira_en: new Date(Date.now() - 1000) },
    );
    await request(app.getHttpServer())
      .post('/api/v2/auth/reset-password')
      .send({ token: current, new_password: 'A-different-password-42!' })
      .expect(400);
    await login(user);
  });
  it('retains valid sessions across application restart with persisted signing keys', async () => {
    const user = await register();
    const tokens = await login(user);
    await app.close();
    await start();
    await me(tokens.access_token).expect(200);
    await request(app.getHttpServer())
      .post('/api/v2/auth/refresh')
      .send({ refresh_token: tokens.refresh_token })
      .expect(200);
  });
});
