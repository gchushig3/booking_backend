import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, toArray } from 'rxjs';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return a pricing record by id', () => {
    expect(appController.obtenerPrecio({ tarId: 1 })).toEqual({
      tarId: 1,
      atrId: 1,
      tarTipo: 'ADULTO',
      tarPrecio: 45.9,
      tarMoneda: 'USD',
    });
  });

  it('should throw NOT_FOUND when the price does not exist', () => {
    expect(() => appController.obtenerPrecio({ tarId: 999 })).toThrow(
      RpcException,
    );
    try {
      appController.obtenerPrecio({ tarId: 999 });
      throw new Error('Expected RpcException');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toMatchObject({
        code: status.NOT_FOUND,
        message: 'Precio con id 999 no existe',
      });
    }
  });

  it('should stream all prices', async () => {
    const prices = await firstValueFrom(
      appController.listarPrecios().pipe(toArray()),
    );

    expect(prices).toHaveLength(3);
    expect(prices[0]).toMatchObject({
      tarId: 1,
      tarTipo: 'ADULTO',
      tarPrecio: 45.9,
    });
    expect(prices[2]).toMatchObject({
      tarId: 3,
      tarTipo: 'ADULTO',
      tarPrecio: 12.5,
    });
  });

  it('should stream prices filtered by type', async () => {
    const prices = await firstValueFrom(
      appController.listarPreciosPorTipo({ tarTipo: 'ADULTO' }).pipe(toArray()),
    );

    expect(prices).toHaveLength(2);
    expect(prices.every((p) => p.tarTipo === 'ADULTO')).toBe(true);
  });
});
