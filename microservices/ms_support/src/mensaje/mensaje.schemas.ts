export interface MensajeInput {
  men_nombre: string;
  men_correo: string;
  men_asunto: string;
  men_cuerpo: string;
}

export const createMensajeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['men_nombre', 'men_correo', 'men_asunto', 'men_cuerpo'],
  properties: {
    men_nombre: { type: 'string', minLength: 1, maxLength: 120 },
    men_correo: { type: 'string', format: 'email', maxLength: 160 },
    men_asunto: { type: 'string', minLength: 1, maxLength: 30 },
    men_cuerpo: { type: 'string', minLength: 1, maxLength: 2000 },
  },
} as const;

export const markReadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['men_leido'],
  properties: { men_leido: { type: 'boolean' } },
} as const;

export const readFilterSchema = { enum: ['true', 'false'] } as const;
