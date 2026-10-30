import { ConfigService } from '@nestjs/config';
import { ReviewOutbox } from './review-outbox.js';

const row = {
  ro_seq: '5',
  ro_event_id: '6f1d7c1e-0000-4000-8000-000000000001',
  ro_payload: { atr_id: '12', ren_id: '1', promedio: 4.5, total: 2 },
  ro_creado_en: new Date('2026-01-01T00:00:00Z'),
};

function setup() {
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.startsWith('SELECT') ? [row] : [],
    ),
  };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => unknown) => work(manager)),
  };
  const publisher = { publish: vi.fn() };
  const outbox = new ReviewOutbox(
    dataSource as never,
    publisher as never,
    new ConfigService({ AMQP_CATALOG_QUEUE: 'q.reviews' }),
  );
  return { manager, publisher, outbox };
}

describe('ReviewOutbox', () => {
  it('publica con eventoId estable y version y marca publicado', async () => {
    const { manager, publisher, outbox } = setup();
    await expect(outbox.flush()).resolves.toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      'q.reviews',
      expect.objectContaining({
        eventoId: row.ro_event_id,
        tipo: 'RESENA_PUBLICADA',
        data: expect.objectContaining({ version: 5, total: 2 }),
      }),
    );
    expect(String(manager.query.mock.calls.at(-1)?.[0])).toContain(
      'ro_publicado_en = now()',
    );
  });

  it('si el broker falla pospone la fila y reintenta con el mismo eventoId', async () => {
    const { manager, publisher, outbox } = setup();
    publisher.publish.mockRejectedValueOnce(new Error('offline'));
    await expect(outbox.flush()).resolves.toBe(0);
    expect(String(manager.query.mock.calls.at(-1)?.[0])).toContain(
      "interval '5 seconds'",
    );
    await expect(outbox.flush()).resolves.toBe(1);
    const ids = publisher.publish.mock.calls.map(([, e]) => e.eventoId);
    expect(ids).toEqual([row.ro_event_id, row.ro_event_id]);
  });
});
