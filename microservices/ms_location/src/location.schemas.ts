const nonEmpty = (maxLength: number) => ({
  type: 'string',
  minLength: 1,
  maxLength,
});

export const createRegionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reg_nombre', 'reg_codigo'],
  properties: {
    reg_nombre: nonEmpty(30),
    reg_codigo: { type: 'string', pattern: '^[A-Z]{2}$' },
  },
};

export const updateRegionSchema = {
  ...createRegionSchema,
  required: [],
  minProperties: 1,
};

export const createProvinciaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reg_id', 'prov_nombre', 'prov_codigo'],
  properties: {
    reg_id: { type: 'integer', minimum: 1, maximum: 32767 },
    prov_nombre: nonEmpty(60),
    prov_codigo: { type: 'string', pattern: '^[0-9]{2}$' },
  },
};

export const updateProvinciaSchema = {
  ...createProvinciaSchema,
  required: [],
  minProperties: 1,
};

export const createCiudadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['prov_id', 'ciu_nombre', 'ciu_codigo'],
  properties: {
    prov_id: { type: 'integer', minimum: 1, maximum: 32767 },
    ciu_nombre: nonEmpty(80),
    ciu_codigo: { type: 'string', pattern: '^[0-9]{6}$' },
    ciu_descripcion: { type: 'string', maxLength: 500 },
    ciu_imagen: { type: 'string', maxLength: 500 },
  },
};

export const updateCiudadSchema = {
  ...createCiudadSchema,
  required: [],
  minProperties: 1,
};

export const attractionLocationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ciu_id', 'geo_latitud', 'geo_longitud'],
  properties: {
    ciu_id: { type: 'integer', minimum: 1, maximum: 32767 },
    geo_latitud: { type: 'number', minimum: -90, maximum: 90 },
    geo_longitud: { type: 'number', minimum: -180, maximum: 180 },
    geo_direccion: { type: 'string', maxLength: 300 },
  },
};
