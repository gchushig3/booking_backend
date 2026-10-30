import 'reflect-metadata';
import { describe, it } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../../src/configure-application.js';

@Controller('future-admin')
class FutureController {
  @Get()
  read(): string {
    return 'sensitive';
  }
}

describe('Default denial', () => {
  it('protects future routes with no security decorators', async () => {
    const module = await Test.createTestingModule({
      controllers: [FutureController],
    }).compile();
    const app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    try {
      await request(app.getHttpServer() as import('node:http').Server)
        .get('/api/v2/future-admin')
        .expect(401);
    } finally {
      await app.close();
    }
  });
});
