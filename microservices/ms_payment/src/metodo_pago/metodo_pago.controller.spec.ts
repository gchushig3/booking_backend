import { Test, TestingModule } from '@nestjs/testing';
import { MetodoPagoController } from './metodo_pago.controller.js';
import { MetodoPagoService } from './metodo_pago.service.js';

describe('MetodoPagoController', () => {
  let controller: MetodoPagoController;
  const service = {
    listar: vi.fn(),
    obtenerPorId: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetodoPagoController],
      providers: [{ provide: MetodoPagoService, useValue: service }],
    }).compile();

    controller = module.get(MetodoPagoController);
  });

  it('delegates catalog listing and the optional active filter', async () => {
    await controller.listar(false);
    expect(service.listar).toHaveBeenCalledWith(false);
  });

  it('delegates lookup by id', async () => {
    await controller.obtenerPorId(2);
    expect(service.obtenerPorId).toHaveBeenCalledWith(2);
  });
});
