import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  InvalidAuditEventError,
  type AuditEventRecord,
  type AuditEnvelope,
} from './audit.schemas.js';

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(
    eventId: string,
    correlationId: string,
    service: string,
    eventType: string,
    payload: Record<string, unknown>,
    timestamp: Date,
    queue: string,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO audit_event
         (event_id, correlation_id, service, event_type, payload,
          event_timestamp, source_queue)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        correlationId,
        service,
        eventType,
        JSON.stringify(payload),
        timestamp,
        queue,
      ],
    );
  }

  async list(filters: {
    correlationId?: string;
    eventType?: string;
    limit?: string;
  }): Promise<AuditEventRecord[]> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (filters.correlationId) {
      values.push(filters.correlationId);
      where.push(`correlation_id = $${values.length}`);
    }
    if (filters.eventType) {
      values.push(filters.eventType);
      where.push(`event_type = $${values.length}`);
    }
    values.push(Math.min(Number(filters.limit ?? 100), 200));
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.dataSource.query(
      `SELECT event_id, correlation_id, service, event_type, payload,
              event_timestamp, source_queue
         FROM audit_event ${clause}
        ORDER BY event_timestamp DESC, event_id
        LIMIT $${values.length}`,
      values,
    );
  }

  async recordEnvelope(
    envelope: AuditEnvelope,
    queue: string,
    messageId: string,
    raw: Record<string, unknown>,
  ): Promise<void> {
    const event =
      envelope.data && typeof envelope.data === 'object'
        ? (envelope.data as AuditEnvelope)
        : envelope;
    const eventType =
      typeof envelope.pattern === 'string' ? envelope.pattern : event.tipo;
    if (typeof eventType !== 'string' || !eventType) {
      throw new InvalidAuditEventError('Evento sin tipo');
    }
    const eventId = event.eventoId ?? messageId;
    const correlationId =
      typeof event.correlationId === 'string' ? event.correlationId : eventId;
    const service = typeof event.origen === 'string' ? event.origen : 'unknown';
    const timestamp = event.fechaISO ? new Date(event.fechaISO) : new Date();
    if (!Number.isFinite(timestamp.getTime())) {
      throw new InvalidAuditEventError('Evento con timestamp invalido');
    }
    await this.record(
      eventId,
      correlationId,
      service,
      eventType,
      raw,
      timestamp,
      queue,
    );
  }
}
