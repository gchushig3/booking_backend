import { JsonSchemaValidationPipe } from "../json-schema.module.js";
import type { DomainEvent } from "../rabbitmq.module.js";

export const sagaBindings = {
  ms_cart: [
    "inventario.reservado",
    "inventario.confirmado",
    "inventario_liberado",
    "reserva.rechazada",
    "reserva.expirada",
    "pago.procesado",
    "pago.fallido",
    "pago_fallido",
    "pago.reembolsado",
  ],
  ms_payment: [
    "reserva.creada",
    "inventario.reservado",
    "reserva.rechazada",
    "reserva.expirada",
    "reembolso.solicitado",
  ],
  ms_inventory: [
    "reserva.creada",
    "pago.procesado",
    "pago.fallido",
    "pago_fallido",
    "pago.reembolsado",
  ],
  ms_refund: ["pago.reembolsado"],
} as const;
export type SagaServiceName = keyof typeof sagaBindings;
export type SagaEventType =
  | "reserva.creada"
  | "reserva.rechazada"
  | "reserva.expirada"
  | "inventario.reservado"
  | "inventario.confirmado"
  | "inventario_liberado"
  | "pago.procesado"
  | "pago.fallido"
  | "pago_fallido"
  | "pago.reembolsado"
  | "reembolso.solicitado";
export interface SagaLine {
  attractionId: string;
  itemId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
  slotId: string;
  adults: number;
  children: number;
  amountCents: number;
}
export interface ReservationData {
  reservationId: string;
  userId: string;
  expiresAt: string;
  currency: "USD";
  amountCents: number;
  lines: SagaLine[];
  testMode?: "test_success" | "test_fail";
  reason?: string;
}
export interface SagaEvent extends DomainEvent<ReservationData> {
  tipo: SagaEventType;
}
export const bigintIdSchema = { type: "string", pattern: "^[1-9][0-9]{0,18}$" };
export const lineSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "attractionId",
    "itemId",
    "serviceId",
    "date",
    "timeSlot",
    "slotId",
    "adults",
    "children",
    "amountCents",
  ],
  properties: {
    attractionId: bigintIdSchema,
    itemId: { type: "string", minLength: 1, maxLength: 220 },
    serviceId: { type: "string", minLength: 1, maxLength: 100 },
    date: { type: "string", format: "date" },
    timeSlot: { type: "string", minLength: 1, maxLength: 40 },
    slotId: { type: "string", pattern: "^slot-[0-9]{8}-[0-9]{4}$" },
    adults: { type: "integer", minimum: 1, maximum: 100 },
    children: { type: "integer", minimum: 0, maximum: 100 },
    amountCents: { type: "integer", minimum: 1, maximum: 999999999999 },
  },
};
export const reservationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reservationId",
    "userId",
    "expiresAt",
    "currency",
    "amountCents",
    "lines",
  ],
  properties: {
    reservationId: { type: "string", format: "uuid" },
    userId: bigintIdSchema,
    expiresAt: { type: "string", format: "date-time" },
    currency: { const: "USD" },
    amountCents: { type: "integer", minimum: 1, maximum: 999999999999 },
    lines: { type: "array", minItems: 1, maxItems: 20, items: lineSchema },
    testMode: { enum: ["test_success", "test_fail"] },
    reason: { type: "string", maxLength: 300 },
  },
};
const eventValidator = new JsonSchemaValidationPipe<SagaEvent>({
  type: "object",
  additionalProperties: false,
  required: ["eventoId", "tipo", "fechaISO", "origen", "correlationId", "data"],
  properties: {
    eventoId: { type: "string", format: "uuid" },
    tipo: { enum: [...new Set(Object.values(sagaBindings).flat())] },
    fechaISO: { type: "string", format: "date-time" },
    origen: { enum: ["ms_cart", "ms_inventory", "ms_payment"] },
    correlationId: { type: "string", format: "uuid" },
    data: reservationSchema,
  },
});

export class PermanentSagaError extends Error {}

export function validateSagaEvent(value: unknown): SagaEvent {
  let event: SagaEvent;
  try {
    event = eventValidator.transform(value);
  } catch {
    throw new PermanentSagaError("Invalid saga contract");
  }
  if (event.data.reservationId !== event.correlationId)
    throw new PermanentSagaError("Reservation/correlation mismatch");
  const origin = event.tipo.startsWith("pago")
    ? "ms_payment"
    : event.tipo === "reserva.creada"
      ? "ms_cart"
      : "ms_inventory";
  if (
    event.origen !== origin ||
    BigInt(event.data.userId) > 9223372036854775807n ||
    event.data.lines.some(
      (line) => BigInt(line.attractionId) > 9223372036854775807n,
    ) ||
    event.data.lines.reduce((sum, line) => sum + line.amountCents, 0) !==
      event.data.amountCents
  ) {
    throw new PermanentSagaError("Inconsistent saga envelope");
  }
  return event;
}
