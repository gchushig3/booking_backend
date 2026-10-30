import { bigintIdSchema } from '@booking/infrastructure';
export interface AddCartItem {
  attractionId: string;
  date: string;
  timeSlot: string;
  slotId: string;
  adults: number;
  children: number;
}
export const addCartItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'attractionId',
    'date',
    'timeSlot',
    'slotId',
    'adults',
    'children',
  ],
  properties: {
    attractionId: bigintIdSchema,
    date: { type: 'string', format: 'date' },
    timeSlot: { type: 'string', minLength: 1, maxLength: 40 },
    slotId: { type: 'string', pattern: '^slot-[0-9]{8}-[0-9]{4}$' },
    adults: { type: 'integer', minimum: 1, maximum: 100 },
    children: { type: 'integer', minimum: 0, maximum: 100 },
  },
};
export const checkoutSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    testMode: { enum: ['test_success', 'test_fail'] },
  },
};
