import { PermanentSagaError } from '@booking/infrastructure';
import {
  PaymentSagaService,
  simulationResult,
} from './payment-saga.service.js';

describe('Simulacion Saga', () => {
  it('usa el umbral configurable sin volver a decidir resultados persistidos', () => {
    expect(simulationResult(undefined, true, false, 0.35, () => 0.349)).toBe(
      false,
    );
    expect(simulationResult(undefined, true, false, 0.35, () => 0.35)).toBe(
      true,
    );
  });

  describe('Solicitudes de reembolso Saga', () => {
    type MockManager = {
      query: (sql: string) => Promise<unknown[]>;
    };

    const payment = {
      state: 'APPROVED',
      payload: {
        reservationId: '8e2d1912-6f9c-458c-b000-12b680a7e9f4',
        userId: '7',
        expiresAt: '2026-10-30T12:00:00.000Z',
        currency: 'USD' as const,
        amountCents: 1250,
        lines: [
          {
            attractionId: '1',
            itemId: 'item-1',
            serviceId: 'NODE',
            date: '2026-11-01',
            timeSlot: '10:00',
            slotId: 'slot-20261101-1000',
            adults: 1,
            children: 0,
            amountCents: 1250,
          },
        ],
      },
    };

    function setup() {
      const manager: MockManager = {
        query: vi.fn(async (sql: string): Promise<unknown[]> => {
          if (sql.includes('INSERT INTO saga_inbox'))
            return [{ event_id: 'event-1' }];
          if (sql.includes('SELECT state, payload FROM saga_payment'))
            return [payment];
          return [];
        }),
      };
      const source = {
        transaction: vi.fn((work: (manager: MockManager) => unknown) =>
          work(manager),
        ),
      };
      const store = { enqueue: vi.fn() };
      const config = { get: vi.fn() };
      return {
        manager,
        store,
        service: new PaymentSagaService(
          source as never,
          store as never,
          config as never,
        ),
      };
    }

    it('solo emite pago.reembolsado por el monto originalmente cobrado', async () => {
      const { manager, store, service } = setup();
      await service.refundRequested({
        eventoId: 'event-1',
        correlationId: payment.payload.reservationId,
        data: { rem_numero: 'REF-1', rem_monto: 12.5 },
      });
      expect(store.enqueue).toHaveBeenCalledWith(
        manager,
        'pago.reembolsado',
        expect.objectContaining({
          reservationId: payment.payload.reservationId,
        }),
      );
    });

    it('rechaza reembolsos mayores o menores al cobro original', async () => {
      const { service } = setup();
      await expect(
        service.refundRequested({
          eventoId: 'event-1',
          correlationId: payment.payload.reservationId,
          data: { rem_numero: 'REF-1', rem_monto: 13 },
        }),
      ).rejects.toBeInstanceOf(PermanentSagaError);
    });
  });
  it('payloads deterministas requieren habilitacion y el simulador siempre es opt-in', () => {
    expect(simulationResult('test_success', true, true, 0.35)).toBe(true);
    expect(simulationResult('test_fail', true, true, 0.35)).toBe(false);
    expect(simulationResult('test_success', true, false, 0.35)).toBe(false);
    expect(simulationResult('test_success', false, true, 0.35)).toBe(false);
  });
});
