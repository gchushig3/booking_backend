import { Test, TestingModule } from '@nestjs/testing';
import { EstadoController } from './estado.controller.js';
import { EstadoService } from './estado.service.js';

describe('EstadoController', () => {
  let controller: EstadoController;
  const service = {
    listar: vi.fn(),
    obtenerPorId: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstadoController],
      providers: [{ provide: EstadoService, useValue: service }],
    }).compile();

    controller = module.get(EstadoController);
  });

  it('delegates listing to the service', async () => {
    await controller.listar();
    expect(service.listar).toHaveBeenCalledOnce();
  });

  it('delegates lookup by id', async () => {
    await controller.obtenerPorId(3);
    expect(service.obtenerPorId).toHaveBeenCalledWith(3);
  });
});
