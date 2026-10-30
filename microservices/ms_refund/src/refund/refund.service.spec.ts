import { RefundService } from './refund.service.js';

describe('RefundService', () => {
  const pending = {
    rem_id: '10',
    rem_event_id: '5b28a829-82b9-4af4-912d-04b4c02120f9',
    pag_id: '22',
    rem_numero: 'REF-2026-01',
    rem_monto: '12.50',
    rem_motivo: 'Cancelacion',
    rem_correlation_id: '8e2d1912-6f9c-458c-b000-12b680a7e9f4',
    rem_estado: 'PENDIENTE' as const,
    rem_solicitado_en: new Date('2026-10-30T12:00:00.000Z'),
  };

  it('persists and publishes one idempotent Saga request', async () => {
    const repository = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((value) => value),
      save: vi.fn().mockResolvedValue(pending),
    };
    const bus = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = new RefundService(repository as never, bus as never);
    await service.request({
      pag_id: '22',
      correlationId: pending.rem_correlation_id,
      rem_numero: pending.rem_numero,
      rem_monto: 12.5,
      rem_motivo: 'Cancelacion',
    });
    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventoId: pending.rem_event_id,
        tipo: 'reembolso.solicitado',
        correlationId: pending.rem_correlation_id,
      }),
    );
  });

  it('marks a confirmed refund processed once', async () => {
    const repository = {
      findOneBy: vi.fn().mockResolvedValue({ ...pending }),
      save: vi.fn().mockImplementation(async (value) => value),
    };
    const service = new RefundService(
      repository as never,
      { publish: vi.fn() } as never,
    );
    await service.confirm({
      eventoId: 'event-2',
      tipo: 'pago.reembolsado',
      fechaISO: '2026-10-30T12:05:00.000Z',
      origen: 'ms_payment',
      correlationId: pending.rem_correlation_id,
      data: {},
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        rem_estado: 'PROCESADO',
        rem_procesado_en: new Date('2026-10-30T12:05:00.000Z'),
      }),
    );
  });
});
