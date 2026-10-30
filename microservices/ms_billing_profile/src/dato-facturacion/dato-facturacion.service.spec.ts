import { ConflictException, NotFoundException } from '@nestjs/common';
import { DatoFacturacionService } from './dato-facturacion.service.js';

function setup() {
  const repo = {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn((value) => ({ ...value })),
    save: vi.fn(async (value) => value),
    update: vi.fn(),
    manager: { transaction: vi.fn(), getRepository: vi.fn() },
  };
  repo.manager.getRepository.mockReturnValue(repo);
  repo.manager.transaction.mockImplementation((work) => work(repo.manager));
  return { repo, service: new DatoFacturacionService(repo as never) };
}
const input = {
  dfa_tipo_identificacion: 'CEDULA' as const,
  dfa_identificacion: '0102030405',
  dfa_razon_social: 'Ana',
  dfa_correo: 'ana@example.com',
};

describe('DatoFacturacionService', () => {
  it('filtra siempre por usuario y activo', async () => {
    const { repo, service } = setup();
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.get('7', '1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findOneBy).toHaveBeenCalledWith({
      dfa_id: '1',
      usu_id: '7',
      dfa_activo: true,
    });
  });

  it('asigna el usuario del token y desmarca el principal anterior', async () => {
    const { repo, service } = setup();
    const saved = await service.create('7', {
      ...input,
      dfa_es_principal: true,
    });
    expect(saved.usu_id).toBe('7');
    expect(repo.update).toHaveBeenCalledWith(
      { usu_id: '7', dfa_es_principal: true },
      { dfa_es_principal: false },
    );
  });

  it('traduce la violacion de unicidad a 409', async () => {
    const { repo, service } = setup();
    repo.save.mockRejectedValue({ driverError: { code: '23505' } });
    await expect(service.create('7', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('elimina de forma logica', async () => {
    const { repo, service } = setup();
    repo.findOneBy.mockResolvedValue({
      dfa_activo: true,
      dfa_es_principal: true,
    });
    await service.remove('7', '1');
    expect(repo.save).toHaveBeenCalledWith({
      dfa_activo: false,
      dfa_es_principal: false,
    });
  });
});
