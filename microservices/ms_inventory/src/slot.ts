import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export interface SlotKey {
  serviceId: string;
  itemId: string;
  date: string;
  timeSlot: string;
  slotId: string;
}
export interface StockUpdate extends SlotKey {
  availableUnits: number;
  timestamp: string | number;
}
export interface StockDelta extends SlotKey {
  eventId: string;
  delta: number;
  timestamp: string | number;
}
export function invalid(message: string): never {
  throw new RpcException({ code: status.INVALID_ARGUMENT, message });
}
export function time24(value: string): string {
  const match =
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(a\.?m\.?|p\.?m\.?))?$/i.exec(value);
  if (!match) return invalid('Invalid time_slot');
  let hour = Number(match[1]);
  const suffix = match[4]?.toLowerCase();
  if (
    Number(match[2]) > 59 ||
    Number(match[3] ?? 0) !== 0 ||
    hour > (suffix ? 12 : 23) ||
    (suffix && hour < 1)
  )
    return invalid('Invalid time_slot');
  if (suffix) hour = (hour % 12) + (suffix.startsWith('p') ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}:00`;
}
export function validateSlot(key: SlotKey) {
  if (
    !key ||
    typeof key.serviceId !== 'string' ||
    !key.serviceId ||
    key.serviceId.length > 100 ||
    typeof key.itemId !== 'string' ||
    !key.itemId ||
    key.itemId.length > 220 ||
    typeof key.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(key.date) ||
    !Number.isFinite(Date.parse(key.date)) ||
    new Date(key.date).toISOString().slice(0, 10) !== key.date ||
    typeof key.timeSlot !== 'string'
  )
    invalid('Invalid slot identity');
  const time = time24(key.timeSlot);
  if (
    key.slotId !==
    `slot-${key.date.replaceAll('-', '')}-${time.slice(0, 5).replace(':', '')}`
  )
    invalid('slot_id/date/time_slot mismatch');
}
export function timestamp(value: string | number): string {
  const raw = String(value);
  if (!/^[1-9]\d{0,18}$/.test(raw) || BigInt(raw) > 9223372036854775807n)
    invalid('Invalid timestamp');
  return raw;
}
