export const TIPOS_IDENTIFICACION = [
  'CEDULA',
  'RUC',
  'PASAPORTE',
  'CONSUMIDOR_FINAL',
] as const;
export type TipoIdentificacion = (typeof TIPOS_IDENTIFICACION)[number];

export interface DatoFacturacionInput {
  dfa_tipo_identificacion: TipoIdentificacion;
  dfa_identificacion: string;
  dfa_razon_social: string;
  dfa_correo: string;
  dfa_telefono?: string;
  dfa_es_principal?: boolean;
}

const properties = {
  dfa_tipo_identificacion: { enum: [...TIPOS_IDENTIFICACION] },
  dfa_identificacion: { type: 'string', minLength: 1, maxLength: 20 },
  dfa_razon_social: { type: 'string', minLength: 1, maxLength: 150 },
  dfa_correo: { type: 'string', format: 'email', maxLength: 160 },
  dfa_telefono: { type: 'string', pattern: '^\\+?[0-9]{7,15}$' },
  dfa_es_principal: { type: 'boolean' },
};

// Mismos formatos que dato_facturacion_identificacion_valida en la base.
const formatoPorTipo = (tipo: TipoIdentificacion, pattern: string) => ({
  anyOf: [
    {
      type: 'object',
      properties: { dfa_tipo_identificacion: { not: { const: tipo } } },
    },
    {
      type: 'object',
      properties: { dfa_identificacion: { type: 'string', pattern } },
    },
  ],
});

export const createDatoFacturacionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'dfa_tipo_identificacion',
    'dfa_identificacion',
    'dfa_razon_social',
    'dfa_correo',
  ],
  properties,
  allOf: [
    formatoPorTipo('CEDULA', '^[0-9]{10}$'),
    formatoPorTipo('RUC', '^[0-9]{13}$'),
    formatoPorTipo('PASAPORTE', '^[A-Z0-9]{6,20}$'),
    formatoPorTipo('CONSUMIDOR_FINAL', '^9999999999999$'),
  ],
} as const;

// El tipo y el numero de identificacion solo se validan en conjunto al crear.
export const updateDatoFacturacionSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    dfa_razon_social: properties.dfa_razon_social,
    dfa_correo: properties.dfa_correo,
    dfa_telefono: properties.dfa_telefono,
    dfa_es_principal: properties.dfa_es_principal,
  },
} as const;

export type UpdateDatoFacturacionInput = Partial<
  Pick<
    DatoFacturacionInput,
    'dfa_razon_social' | 'dfa_correo' | 'dfa_telefono' | 'dfa_es_principal'
  >
>;
