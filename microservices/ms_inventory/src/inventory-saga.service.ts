import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  SagaStore,
  lockSaga,
  PermanentSagaError,
  sagaHash,
} from '@booking/infrastructure';
import type { SagaEvent, ReservationData } from '@booking/infrastructure';
import { InventoryService } from './inventory.service.js';
import { validateSlot } from './slot.js';

interface Allocation {
  disId: string;
  quantity: number;
}
interface Hold {
  state: 'HELD' | 'CONFIRMED' | 'RELEASED' | 'REJECTED';
  payload: ReservationData;
  allocations: Allocation[];
  expired: boolean;
}
const fingerprint = ({ reason: _reason, ...data }: ReservationData) =>
  sagaHash(data);

@Injectable()
export class InventorySagaService
  implements OnModuleInit, OnApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private readonly logger = new Logger(InventorySagaService.name);
  constructor(
    private readonly source: DataSource,
    private readonly store: SagaStore,
    private readonly inventory: InventoryService,
  ) {}

  async event(event: SagaEvent) {
    await this.store.consume(event, async (manager) => {
      const [hold] = await manager.query<Hold[]>(
        'SELECT *,expires_at<=clock_timestamp() AS expired FROM saga_inventory_hold WHERE reservation_id=$1 FOR UPDATE',
        [event.correlationId],
      );
      if (hold && fingerprint(hold.payload) !== fingerprint(event.data))
        throw new PermanentSagaError('Reservation payload changed');
      if (event.tipo === 'reserva.creada') {
        if (hold) return;
        await this.reserve(manager, event.data);
        return;
      }
      if (!hold) {
        // Fallo adelantado: tombstone impide descontar cuando llegue reserva.creada tarde.
        if (event.tipo !== 'pago.procesado')
          await manager.query(
            "INSERT INTO saga_inventory_hold(reservation_id,payload,state,expires_at) VALUES ($1,$2::jsonb,'RELEASED',$3)",
            [
              event.correlationId,
              JSON.stringify(event.data),
              event.data.expiresAt,
            ],
          );
        else
          throw new PermanentSagaError(
            'Payment arrived without stock authorization',
          );
        return;
      }
      if (event.tipo === 'pago.reembolsado') {
        if (hold.state === 'CONFIRMED')
          await this.release(manager, hold, 'Refunded by customer cancellation');
        return;
      }
      if (hold.state !== 'HELD') return;
      if (event.tipo === 'pago.procesado' && !hold.expired) {
        const changed = await manager.query<Array<{ reservation_id: string }>>(
          "UPDATE saga_inventory_hold SET state='CONFIRMED' WHERE reservation_id=$1 AND expires_at>clock_timestamp() RETURNING reservation_id",
          [event.correlationId],
        );
        if (changed.length)
          await this.store.enqueue(
            manager,
            'inventario.confirmado',
            hold.payload,
          );
        else await this.release(manager, hold, 'Reservation expired');
      } else {
        await this.release(
          manager,
          hold,
          hold.expired ? 'Reservation expired' : 'Payment rejected',
        );
      }
    });
  }

  private async reserve(manager: EntityManager, data: ReservationData) {
    const quantities = new Map<string, number>();
    let reason: string | undefined;
    for (const line of data.lines) {
      try {
        validateSlot(line);
      } catch {
        throw new PermanentSagaError('Invalid slot in reservation');
      }
      const slot = await this.inventory.find(manager, line);
      if (!slot) {
        reason = 'Slot not found';
        break;
      }
      quantities.set(
        slot.dis_id,
        (quantities.get(slot.dis_id) ?? 0) + line.adults + line.children,
      );
    }
    const allocations = [...quantities]
      .sort(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1))
      .map(([disId, quantity]) => ({ disId, quantity }));
    const rows = allocations.length
      ? await manager.query<
          Array<{
            dis_id: string;
            dis_cupo_total: number;
            dis_cupo_reservado: number;
            dis_cerrada: boolean;
            hor_activo: boolean;
          }>
        >(
          `SELECT d.*,h.hor_activo FROM disponibilidad d JOIN horario h USING(hor_id)
      WHERE dis_id=ANY($1::bigint[]) ORDER BY dis_id FOR UPDATE OF d`,
          [allocations.map((a) => a.disId)],
        )
      : [];
    const [{ expired }] = await manager.query<Array<{ expired: boolean }>>(
      'SELECT $1::timestamptz <= clock_timestamp() AS expired',
      [data.expiresAt],
    );
    if (expired) reason = 'Reservation expired';
    for (const allocation of allocations) {
      const row = rows.find((r) => r.dis_id === allocation.disId);
      if (
        !row ||
        row.dis_cerrada ||
        !row.hor_activo ||
        row.dis_cupo_total - row.dis_cupo_reservado < allocation.quantity
      )
        reason = 'Insufficient stock';
    }
    await manager.query(
      'INSERT INTO saga_inventory_hold(reservation_id,payload,state,expires_at,allocations) VALUES ($1,$2::jsonb,$3,$4,$5::jsonb)',
      [
        data.reservationId,
        JSON.stringify(data),
        reason ? 'REJECTED' : 'HELD',
        data.expiresAt,
        JSON.stringify(reason ? [] : allocations),
      ],
    );
    if (reason) {
      await this.store.enqueue(manager, 'reserva.rechazada', {
        ...data,
        reason,
      });
      return;
    }
    for (const allocation of allocations) {
      await manager.query(
        'UPDATE disponibilidad SET dis_cupo_reservado=dis_cupo_reservado+$2 WHERE dis_id=$1',
        [allocation.disId, allocation.quantity],
      );
    }
    await this.store.enqueue(manager, 'inventario.reservado', data);
  }

  private async release(manager: EntityManager, hold: Hold, reason: string) {
    for (const allocation of hold.allocations) {
      const updated = await manager.query<Array<{ dis_id: string }>>(
        `UPDATE disponibilidad SET dis_cupo_reservado=dis_cupo_reservado-$2
        WHERE dis_id=$1 AND dis_cupo_reservado >= $2 RETURNING dis_id`,
        [allocation.disId, allocation.quantity],
      );
      if (!updated.length) throw new Error('Stock ledger invariant violated');
    }
    await manager.query(
      "UPDATE saga_inventory_hold SET state='RELEASED' WHERE reservation_id=$1",
      [hold.payload.reservationId],
    );
    await this.store.enqueue(manager, 'inventario_liberado', {
      ...hold.payload,
      reason,
    });
    if (reason === 'Reservation expired')
      await this.store.enqueue(manager, 'reserva.expirada', {
        ...hold.payload,
        reason,
      });
  }

  async expire() {
    const rows = await this.source.query<Array<{ reservation_id: string }>>(
      "SELECT reservation_id FROM saga_inventory_hold WHERE state='HELD' AND expires_at<=now() ORDER BY expires_at LIMIT 50",
    );
    for (const row of rows)
      await this.source.transaction(async (manager) => {
        await lockSaga(manager, row.reservation_id);
        const [hold] = await manager.query<Hold[]>(
          'SELECT *,expires_at<=clock_timestamp() AS expired FROM saga_inventory_hold WHERE reservation_id=$1 FOR UPDATE',
          [row.reservation_id],
        );
        if (hold?.state === 'HELD' && hold.expired)
          await this.release(manager, hold, 'Reservation expired');
      });
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      this.pending ??= this.expire()
        .catch(() => this.logger.error('Hold expiration retry pending'))
        .finally(() => {
          this.pending = undefined;
        });
    }, 1000);
    this.timer.unref();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.pending;
  }
}
