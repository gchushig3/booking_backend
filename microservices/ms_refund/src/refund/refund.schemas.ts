export interface RefundRequest {
  pag_id: string;
  correlationId: string;
  rem_numero: string;
  rem_monto: number;
  rem_motivo?: string;
}

export interface RefundConfirmation {
  eventoId: string;
  tipo: 'pago.reembolsado';
  fechaISO: string;
  origen: string;
  correlationId: string;
  data: Record<string, unknown>;
}

export const refundRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pag_id', 'correlationId', 'rem_numero', 'rem_monto'],
  properties: {
    pag_id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
    correlationId: { type: 'string', format: 'uuid' },
    rem_numero: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,30}$' },
    rem_monto: {
      type: 'number',
      exclusiveMinimum: 0,
      maximum: 9999999999.99,
      multipleOf: 0.01,
    },
    rem_motivo: { type: 'string', maxLength: 300 },
  },
};

export const refundEventSchema = {
  type: 'object',
  required: ['eventoId', 'tipo', 'fechaISO', 'origen', 'correlationId', 'data'],
  properties: {
    eventoId: { type: 'string', minLength: 1, maxLength: 128 },
    tipo: { const: 'pago.reembolsado' },
    fechaISO: { type: 'string', format: 'date-time' },
    origen: { type: 'string', minLength: 1, maxLength: 80 },
    correlationId: { type: 'string', minLength: 1, maxLength: 128 },
    data: { type: 'object' },
  },
};

export class InvalidRefundEventError extends Error {}
