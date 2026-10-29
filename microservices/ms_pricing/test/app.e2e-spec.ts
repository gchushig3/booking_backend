import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { AppController } from '../src/app.controller.js';

describe('AppController (e2e)', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = moduleFixture.get<AppController>(AppController);
  });

  it('should return the price for the given id', () => {
    expect(controller.obtenerPrecio({ tarId: 1 })).toMatchObject({
      tarId: 1,
      tarTipo: 'ADULTO',
      tarPrecio: 45.9,
    });
  });

  it('should list all prices via streaming', async () => {
    const prices = await firstValueFrom(
      controller.listarPrecios().pipe(toArray()),
    );
    expect(prices).toHaveLength(3);
  });
});
