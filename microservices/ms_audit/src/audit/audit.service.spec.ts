import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('normaliza el envelope y persiste correlation, origin, type y payload', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = new AuditService({ query } as never);
    const envelope = {
      pattern: 'pago.reembolsado',
      data: {
        eventoId: 'event-1',
        tipo: 'pago.reembolsado',
        origen: 'ms_payment',
        correlationId: 'reservation-1',
        fechaISO: '2026-10-30T12:00:00.000Z',
        data: { amountCents: 500 },
      },
    };
    await service.recordEnvelope(
      envelope,
      'booking.audit.events',
      'event-1',
      envelope,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
      [
        'event-1',
        'reservation-1',
        'ms_payment',
        'pago.reembolsado',
        JSON.stringify(envelope),
        new Date('2026-10-30T12:00:00.000Z'),
        'booking.audit.events',
      ],
    );
  });
});
