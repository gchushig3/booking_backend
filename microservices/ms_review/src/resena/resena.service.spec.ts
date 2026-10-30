import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResenaService } from './resena.service.js';

function setup() {
  const manager = {
    create: vi.fn((_entity, value) => ({ ...value })),
    save: vi.fn(async (value) => ({
      ren_id: '1',
      ren_visible: true,
      ...value,
    })),
    findOneBy: vi.fn(),
    query: vi.fn(async (sql: string, _params?: unknown[]) =>
      sql.includes('AVG') ? [{ promedio: '4.50', total: 2 }] : [],
    ),
  };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => unknown) => work(manager)),
  };
  const repo = { find: vi.fn() };
  const service = new ResenaService(repo as never, dataSource as never);
  return { manager, service };
}
const input = { atr_id: '12', ren_puntuacion: 5, ren_comentario: 'Genial' };
const outboxInserts = (manager: ReturnType<typeof setup>['manager']) =>
  manager.query.mock.calls.filter(([sql]) =>
    String(sql).includes('INSERT INTO review_outbox'),
  );

describe('ResenaService', () => {
  it('guarda la resena y encola RESENA_PUBLICADA en la misma transaccion', async () => {
    const { manager, service } = setup();
    const saved = await service.create('7', input);
    expect(saved.usu_id).toBe('7');
    const [[, params]] = outboxInserts(manager);
    expect(JSON.parse(String(params?.[1]))).toMatchObject({
      atr_id: '12',
      ren_id: '1',
      promedio: 4.5,
      total: 2,
    });
  });

  it('traduce resena duplicada a 409 sin encolar', async () => {
    const { manager, service } = setup();
    manager.save.mockRejectedValue({ driverError: { code: '23505' } });
    await expect(service.create('7', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(outboxInserts(manager)).toHaveLength(0);
  });

  it('moderar una resena inexistente da 404', async () => {
    const { manager, service } = setup();
    manager.findOneBy.mockResolvedValue(null);
    await expect(service.setVisible('9', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('moderar encola el nuevo agregado', async () => {
    const { manager, service } = setup();
    manager.findOneBy.mockResolvedValue({ ren_id: '1', atr_id: '12' });
    await service.setVisible('1', false);
    expect(outboxInserts(manager)).toHaveLength(1);
  });
});
