export const auditFilterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    correlationId: { type: 'string', minLength: 1, maxLength: 128 },
    eventType: { type: 'string', minLength: 1, maxLength: 80 },
    limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' },
  },
};

export interface AuditEnvelope {
  pattern?: string;
  data?: Record<string, unknown>;
  eventoId?: string;
  tipo?: string;
  origen?: string;
  correlationId?: string;
  fechaISO?: string;
}

export interface AuditEventRecord {
  event_id: string;
  correlation_id: string;
  service: string;
  event_type: string;
  payload: Record<string, unknown>;
  event_timestamp: Date;
  source_queue: string;
}

export class InvalidAuditEventError extends Error {}
