import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomInt } from 'node:crypto';
import {
  SagaStore,
  PermanentSagaError,
  sagaHash,
  lockSaga,
} from '@booking/infrastructure';
import type { SagaEvent, ReservationData } from '@booking/infrastructure';

export function simulationResult(
  mode: ReservationData['testMode'],
  enabled: boolean,
  allowTests: boolean,
  failureRate: number,
  random: () => number = () => randomInt(1000000) / 1000000,
): boolean {
  if (!enabled || (mode && !allowTests)) return false;
  if (mode) return mode === 'test_success';
  return random() >= failureRate;
}
interface PaymentSagaRow {
  state: 'PENDING' | 'APPROVED' | 'FAILED' | 'REFUNDED';
  created_seen: boolean;
  stock_held: boolean;
  payload: ReservationData;
}
const fingerprint = ({ reason: _reason, ...data }: ReservationData) =>
  sagaHash(data);

@Injectable()
export class PaymentSagaService {
  private readonly failureRate: number;
  private readonly enabled: boolean;
  private readonly allowTests: boolean;
  constructor(
    private readonly source: DataSource,
    private readonly store: SagaStore,
    private readonly config: ConfigService,
  ) {
    this.failureRate = Number(
      config.get('PAYMENT_SIMULATION_FAILURE_RATE') ?? 0.35,
    );
    if (
      !Number.isFinite(this.failureRate) ||
      this.failureRate < 0 ||
      this.failureRate > 1
    )
      throw new Error('Invalid PAYMENT_SIMULATION_FAILURE_RATE');
    this.enabled = config.get('SAGA_SIMULATION_ENABLED') === 'true';
    this.allowTests =
      config.get('NODE_ENV') !== 'production' &&
      config.get('PAYMENT_ALLOW_TEST_PAYLOADS') === 'true';
  }

  async event(event: SagaEvent) {
    await this.store.consume(event, async (manager) => {
      await manager.query(
        'INSERT INTO saga_payment(reservation_id,payload) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING',
        [event.correlationId, JSON.stringify(event.data)],
      );
      const [row] = await manager.query<PaymentSagaRow[]>(
        'SELECT state,created_seen,stock_held,payload FROM saga_payment WHERE reservation_id=$1 FOR UPDATE',
        [event.correlationId],
      );
      if (fingerprint(row.payload) !== fingerprint(event.data))
        throw new PermanentSagaError('Reservation payload changed');
      if (['reserva.rechazada', 'reserva.expirada'].includes(event.tipo)) {
        if (row.state === 'APPROVED') {
          await manager.query(
            "UPDATE saga_payment SET state='REFUNDED',resolved_at=now() WHERE reservation_id=$1",
            [event.correlationId],
          );
          await this.store.enqueue(manager, 'pago.reembolsado', {
            ...row.payload,
            reason: 'Stock expired before final confirmation',
          });
        } else if (row.state === 'PENDING') {
          await manager.query(
            "UPDATE saga_payment SET state='FAILED',resolved_at=now() WHERE reservation_id=$1",
            [event.correlationId],
          );
          await this.store.enqueue(manager, 'pago.fallido', {
            ...row.payload,
            reason: 'Inventory rejected or expired',
          });
        }

        return;
      }
      if (row.state !== 'PENDING') return;
      const created = row.created_seen || event.tipo === 'reserva.creada';
      const held = row.stock_held || event.tipo === 'inventario.reservado';
      await manager.query(
        'UPDATE saga_payment SET created_seen=$2,stock_held=$3 WHERE reservation_id=$1',
        [event.correlationId, created, held],
      );
      if (!created || !held) return; // Los mensajes pueden llegar en cualquier orden.
      const [{ expired }] = await manager.query<Array<{ expired: boolean }>>(
        'SELECT $1::timestamptz <= clock_timestamp() AS expired',
        [row.payload.expiresAt],
      );
      const approved =
        !expired &&
        simulationResult(
          row.payload.testMode,
          this.enabled,
          this.allowTests,
          this.failureRate,
        );
      await manager.query(
        'UPDATE saga_payment SET state=$2,resolved_at=now() WHERE reservation_id=$1',
        [event.correlationId, approved ? 'APPROVED' : 'FAILED'],
      );
      await this.store.enqueue(
        manager,
        approved ? 'pago.procesado' : 'pago.fallido',
        {
          ...row.payload,
          ...(approved
            ? {}
            : {
                reason: expired
                  ? 'Reservation expired'
                  : 'Simulated payment rejected or simulation disabled',
              }),
        },
      );
    });
  }

  async refundRequested(event: {
    eventoId: string;
    correlationId: string;
    data: { rem_numero: string; rem_monto: number };
  }): Promise<void> {
    await this.source.transaction(async (manager) => {
      await lockSaga(manager, event.correlationId);
      const hash = sagaHash(event);
      const inserted = await manager.query<Array<{ event_id: string }>>(
        `INSERT INTO saga_inbox (event_id, payload_hash)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id`,
        [event.eventoId, hash],
      );
      if (!inserted.length) {
        const [existing] = await manager.query<Array<{ payload_hash: string }>>(
          'SELECT payload_hash FROM saga_inbox WHERE event_id = $1',
          [event.eventoId],
        );
        if (existing.payload_hash !== hash)
          throw new PermanentSagaError('Event ID reused with another payload');
        return;
      }

      const [payment] = await manager.query<
        Array<{ state: PaymentSagaRow['state']; payload: ReservationData }>
      >(
        'SELECT state, payload FROM saga_payment WHERE reservation_id = $1 FOR UPDATE',
        [event.correlationId],
      );
      if (!payment || payment.state !== 'APPROVED') {
        throw new PermanentSagaError('Only approved payments can be refunded');
      }
      if (
        Math.round(event.data.rem_monto * 100) !== payment.payload.amountCents
      ) {
        throw new PermanentSagaError(
          'Refund amount must equal the original payment amount',
        );
      }

      await manager.query(
        "UPDATE saga_payment SET state = 'REFUNDED', resolved_at = now() WHERE reservation_id = $1",
        [event.correlationId],
      );
      await this.store.enqueue(manager, 'pago.reembolsado', {
        ...payment.payload,
        reason: `Refund requested: ${event.data.rem_numero}`,
      });
    });
  }

  async get(userId: string, id: string, roles: string[]) {
    const [row] = await this.source.query<
      Array<{ payload: ReservationData; state: string }>
    >('SELECT payload,state FROM saga_payment WHERE reservation_id=$1', [id]);
    if (!row || (row.payload.userId !== userId && !roles.includes('ADMIN')))
      throw new NotFoundException('Payment not found');
    return {
      reservationId: id,
      state: row.state,
      amountCents: row.payload.amountCents,
      currency: row.payload.currency,
    };
  }

  preview(body: { testMode?: ReservationData['testMode'] }) {
    if (!this.allowTests)
      throw new ForbiddenException('Test simulations disabled');
    return {
      approved: simulationResult(
        body.testMode,
        this.enabled,
        this.allowTests,
        this.failureRate,
      ),
      simulated: true,
    };
  }
}
