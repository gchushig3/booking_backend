import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { Reflector, MetadataScanner } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { DataSource } from 'typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parseDocument } from 'yaml';
import type {
  OpenAPIObject,
  OperationObject,
  SchemaObject,
} from '@nestjs/swagger';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateEnvironment } from '../../src/config/environment.js';
import { configureApplication } from '../../src/configure-application.js';
import { bootstrapAdmin } from '../../src/users/bootstrap-admin.js';
import { UsuarioEntity } from '../../src/database/entities/index.js';
import {
  AuthController,
  JwksController,
} from '../../src/auth/auth.controller.js';
import {
  UsersController,
  RolesController,
} from '../../src/users/users.controller.js';
import { HealthController } from '../../src/health/health.controller.js';
import {
  PUBLIC_ROUTE,
  REQUIRED_ROLES,
} from '../../src/auth/auth.decorators.js';
const env = validateEnvironment(process.env);
if (
  env.APP_ENV !== 'test' ||
  env.NODE_ENV !== 'test' ||
  env.DB_HOST !== '127.0.0.1' ||
  env.DB_PORT !== 5442 ||
  env.DB_DATABASE !== 'ms_identity_test'
)
  throw new Error('Isolated local Identity test database required.');
process.env.JWT_KEYRING_PATH = '.keys/identity.test.json';
process.env.BCRYPT_ROUNDS = '4';
process.env.AUTH_LOGIN_LIMIT = '1000';
process.env.AUTH_RECOVERY_LIMIT = '1000';
let app: INestApplication<Server>;
let source: DataSource;
let document: OpenAPIObject;
const password = randomBytes(32).toString('base64url');
const email = `openapi-${randomUUID()}@example.test`;
const adminEmail = `openapi-admin-${randomUUID()}@example.test`;
let clientToken: string;
const api = () => request(app.getHttpServer());
describe('Phase F Swagger and executable internal contract', () => {
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
    document = (await api().get('/api/docs-json').expect(200))
      .body as OpenAPIObject;
  });
  afterAll(async () => {
    if (source?.isInitialized)
      await source.query(
        'DELETE FROM usuario WHERE usu_correo=ANY($1::text[])',
        [[email, adminEmail]],
      );
    const messages = (await (
      await fetch('http://127.0.0.1:8025/api/v1/messages?limit=1000')
    ).json()) as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const ids = messages.messages
      .filter((m) => m.To.some((t) => [email, adminEmail].includes(t.Address)))
      .map((m) => m.ID);
    if (ids.length)
      await fetch('http://127.0.0.1:8025/api/v1/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: ids }),
      });
    await app?.close();
  });
  it('serves UI, local assets, JSON and YAML without Authorization and without persistence of Bearer credentials', async () => {
    const ui = await api().get('/api/docs').expect(200);
    expect(ui.text).toContain('swagger-ui');
    for (const asset of [
      'swagger-ui-bundle.js',
      'swagger-ui.css',
      'swagger-ui-init.js',
    ])
      await api().get(`/api/docs/${asset}`).expect(200);
    const init = await api().get('/api/docs/swagger-ui-init.js');
    expect(init.text).toMatch(/"persistAuthorization":\s*false/);
    expect(init.text).toMatch(/"validatorUrl":\s*null/);
    const yaml = await api().get('/api/docs-yaml').expect(200);
    const parsed = parseDocument(yaml.text, { uniqueKeys: true });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.toJS()).toEqual(document);
    expect(document.openapi).toBe('3.0.0');
    await SwaggerParser.validate('docs/openapi.json', {
      resolve: { external: false },
    });
  });
  it('documents exactly the real routes and derives the correct public/protected requirements from guard metadata', () => {
    const reflector = new Reflector();
    const scanner = new MetadataScanner();
    let count = 0;
    for (const controller of [
      AuthController,
      JwksController,
      UsersController,
      RolesController,
      HealthController,
    ]) {
      const prototype = controller.prototype;
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = (
          prototype as unknown as Record<
            string,
            (...args: unknown[]) => unknown
          >
        )[name]!;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          | number
          | undefined;
        if (method === undefined) continue;
        const path =
          `/api/v2/${Reflect.getMetadata(PATH_METADATA, controller) as string}/${Reflect.getMetadata(PATH_METADATA, handler) as string}`
            .replace(/\/+$/, '')
            .replace(/:([^/]+)/g, '{$1}');
        const verb = RequestMethod[method]!.toLowerCase();
        const operation = document.paths[path]?.[verb as 'get'] as
          | OperationObject
          | undefined;
        expect(operation).toBeDefined();
        expect(operation?.summary).toBeTruthy();
        const isPublic = reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
          handler,
          controller,
        ]);
        expect(operation?.security).toEqual(isPublic ? [] : [{ bearer: [] }]);
        const roles = reflector.getAllAndOverride<string[]>(REQUIRED_ROLES, [
          handler,
          controller,
        ]);
        if (roles?.includes('ADMIN'))
          expect(operation?.description).toContain('Requiere ADMIN activo');
        expect(operation?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              in: 'header',
              name: 'X-Correlation-Id',
              required: false,
            }),
          ]),
        );
        count++;
      }
    }
    expect(count).toBe(25);
    expect(
      Object.values(document.paths).reduce(
        (n, path) => n + Object.keys(path!).length,
        0,
      ),
    ).toBe(count);
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });
  it('exports synchronized valid artifacts, real DTO constraints, string BIGINTs and no database secrets', async () => {
    const exported = JSON.parse(
      await readFile('docs/openapi.json', 'utf8'),
    ) as OpenAPIObject;
    expect(exported).toEqual(document);
    const yaml = parseDocument(await readFile('docs/openapi.yaml', 'utf8'), {
      uniqueKeys: true,
    });
    expect(yaml.errors).toHaveLength(0);
    expect(yaml.toJS()).toEqual(document);
    const schemas = document.components!.schemas!;
    const register = schemas.RegisterDto as SchemaObject;
    expect(register.required).toEqual(
      expect.arrayContaining(['email', 'password', 'first_name', 'last_name']),
    );
    expect(register.additionalProperties).toBe(false);
    const emailSchema = register.properties!.email as SchemaObject;
    expect(new RegExp(emailSchema.pattern!).test('ana@example.test')).toBe(
      true,
    );
    const phone = (schemas.ProfileDto as SchemaObject).properties!
      .phone as SchemaObject;
    expect(new RegExp(phone.pattern!).test('+593999999999')).toBe(true);
    expect((schemas.ProfileDto as SchemaObject).minProperties).toBe(1);
    expect(
      ((schemas.UserResponse as SchemaObject).properties!.id as SchemaObject)
        .type,
    ).toBe('string');
    for (const name of [
      'usu_password',
      'ses_token_hash',
      'tokv_token',
      'privateJwk',
      'DB_PASSWORD',
    ])
      expect(JSON.stringify(document)).not.toContain(name);
    expect(JSON.stringify(schemas.PublicJwkResponse)).not.toContain('private');
  });
  it('registers and logs in without JWT, then uses the resulting access token on both me endpoints', async () => {
    const registered = await api()
      .post('/api/v2/auth/register')
      .send({ email, password, first_name: 'Swagger', last_name: 'Prueba' })
      .expect(201);
    expect(registered.body.user.roles).toEqual(['CLIENTE']);
    const login = await api()
      .post('/api/v2/auth/login')
      .send({ email, password })
      .expect(200);
    clientToken = login.body.access_token as string;
    await api().get('/api/v2/auth/me').expect(401);
    await api()
      .get('/api/v2/auth/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const profile = await api()
      .get('/api/v2/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(profile.body.email).toBe(email);
    const schema = document.components!.schemas!.UserResponse as SchemaObject;
    expect(Object.keys(profile.body).sort()).toEqual(
      Object.keys(schema.properties!).sort(),
    );
  });
  it('documents and returns 400/401/403/409 with Problem Details and correlation', async () => {
    const invalid = await api()
      .post('/api/v2/auth/login')
      .send({ email: 'invalid', password: 'bad' })
      .expect(400);
    const unauthenticated = await api().get('/api/v2/users/me').expect(401);
    const denied = await api()
      .get('/api/v2/users')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
    const conflict = await api()
      .post('/api/v2/auth/register')
      .send({ email, password, first_name: 'Swagger', last_name: 'Prueba' })
      .expect(409);
    for (const response of [invalid, unauthenticated, denied, conflict]) {
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(response.body.status).toBe(response.status);
      expect(response.body.correlation_id).toBe(
        response.headers['x-correlation-id'],
      );
    }
    expect(
      document.paths['/api/v2/auth/login']!.post!.responses['400'],
    ).toHaveProperty('content.application/problem+json');
    expect(
      document.paths['/api/v2/users']!.get!.responses['403'],
    ).toBeDefined();
    for (const path of Object.values(document.paths))
      for (const op of Object.values(path!) as OperationObject[])
        for (const [status, response] of Object.entries(op.responses))
          if (status === '204') expect(response).not.toHaveProperty('content');
  });
  it('obtains an ADMIN token through the actual bootstrap and executes the documented administrative operations', async () => {
    expect(
      await bootstrapAdmin(source, env, {
        enabled: 'true',
        email: adminEmail,
        password,
        firstName: 'Swagger',
        lastName: 'Admin',
      }),
    ).toBe('created');
    const login = await api()
      .post('/api/v2/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    const token = login.body.access_token as string;
    await api()
      .get('/api/v2/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await api()
      .get('/api/v2/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const user = await source.manager.findOneByOrFail(UsuarioEntity, {
      usu_correo: email,
    });
    await api()
      .get(`/api/v2/users/${user.usu_id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
