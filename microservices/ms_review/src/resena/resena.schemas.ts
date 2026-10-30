import { bigintIdSchema } from '@booking/infrastructure';

export interface ResenaInput {
  atr_id: string;
  ren_puntuacion: number;
  ren_comentario: string;
}

export const createResenaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['atr_id', 'ren_puntuacion', 'ren_comentario'],
  properties: {
    atr_id: bigintIdSchema,
    ren_puntuacion: { type: 'integer', minimum: 1, maximum: 5 },
    ren_comentario: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;

export const visibilitySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ren_visible'],
  properties: { ren_visible: { type: 'boolean' } },
} as const;
