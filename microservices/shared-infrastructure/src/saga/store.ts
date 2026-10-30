import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { PermanentSagaError } from './contracts.js';
import type { SagaEvent, SagaEventType, SagaServiceName, ReservationData } from './contracts.js';

export const SAGA_SERVICE = Symbol('SAGA_SERVICE');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const sagaHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export async function lockSaga(manager: EntityManager, key: string) {
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

@Injectable()
export class SagaStore {
  constructor(private readonly source: DataSource, @Inject(SAGA_SERVICE) private readonly origin: SagaServiceName) {}

  async consume(event: SagaEvent, work: (manager: EntityManager) => Promise<void>): Promise<void> {
    await this.source.transaction(async (manager) => {
      await lockSaga(manager, event.correlationId);
      const hash = sagaHash(event);
      const inserted = await manager.query<Array<{ event_id: string }>>(
        'INSERT INTO saga_inbox(event_id, payload_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_id', [event.eventoId, hash]);
      if (!inserted.length) {
        const [existing] = await manager.query<Array<{ payload_hash: string }>>('SELECT payload_hash FROM saga_inbox WHERE event_id=$1', [event.eventoId]);
        if (existing.payload_hash !== hash) throw new PermanentSagaError('Event ID reused with another payload');
        return;
      }
      await work(manager); // Inbox, negocio y outbox confirman en la misma transaccion.
    });
  }

  async http<T>(owner: string, operation: string, key: string, payload: unknown,
    work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.source.transaction(async (manager) => {
      const id = `${owner}:${operation}:${key}`;
      await lockSaga(manager, id);
      const [prior] = await manager.query<Array<{ payload_hash: string; response: T }>>('SELECT payload_hash,response FROM saga_http_request WHERE request_key=$1', [id]);
      const hash = sagaHash(payload);
      if (prior) {
        if (prior.payload_hash !== hash) throw new ConflictException('Idempotency-Key reutilizada con otro payload');
        return prior.response;
      }
      const response = await work(manager);
      await manager.query('INSERT INTO saga_http_request(request_key,payload_hash,response) VALUES ($1,$2,$3::jsonb)', [id, hash, JSON.stringify(response)]);
      return response;
    });
  }

  async enqueue(manager: EntityManager, type: SagaEventType, data: ReservationData): Promise<void> {
    const event: SagaEvent = { eventoId: randomUUID(), tipo: type, fechaISO: new Date().toISOString(),
      origen: this.origin, correlationId: data.reservationId, data };
    await manager.query('INSERT INTO saga_outbox(event_id,payload) VALUES ($1,$2::jsonb)', [event.eventoId, JSON.stringify(event)]);
  }
}
