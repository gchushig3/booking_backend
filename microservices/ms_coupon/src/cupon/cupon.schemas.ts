export interface CreateCuponInput {
  cup_codigo: string;
  cup_tipo: string;
  cup_valor: number | string;
  cup_fecha_inicio: string | Date;
  cup_fecha_fin?: string | Date | null;
  cup_usos_max?: number | null;
  cup_activo?: boolean;
}

export type UpdateCuponInput = Partial<CreateCuponInput>;

const date = { type: 'string', format: 'date' };
const properties = {
  cup_codigo: {
    type: 'string',
    minLength: 1,
    maxLength: 30,
    pattern: '^[A-Z0-9_-]+$',
  },
  cup_tipo: { type: 'string', enum: ['PORCENTAJE', 'FIJO'] },
  cup_valor: { type: 'number', minimum: 0, maximum: 9999999999.99 },
  cup_fecha_inicio: date,
  cup_fecha_fin: { anyOf: [date, { type: 'null' }] },
  cup_usos_max: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
  cup_activo: { type: 'boolean' },
};

export const createCuponSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cup_codigo', 'cup_tipo', 'cup_valor', 'cup_fecha_inicio'],
  properties,
  allOf: [
    {
      if: {
        properties: { cup_tipo: { const: 'PORCENTAJE' } },
        required: ['cup_tipo'],
      },
      then: { properties: { cup_valor: { type: 'number', maximum: 100 } } },
    },
  ],
};

export const updateCuponSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties,
};

export const validateCuponSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { fecha: date },
};
