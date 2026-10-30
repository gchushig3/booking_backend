import { bookingDefinitions, bookingSchema } from './contract-schemas.js';

export const searchSchema = bookingSchema('SearchAtraccionesRequestV2');
const detail = bookingDefinitions.AtraccionDetailResponseV2;
const properties = detail.properties;
export const profileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['city', 'price', 'inclusions', 'itinerary', 'ratings_breakdown'],
  properties: {
    city: { type: 'string', minLength: 1 },
    price: {
      ...bookingDefinitions.TarifaBaseDesglosada,
      additionalProperties: false,
    },
    inclusions: {
      ...bookingDefinitions.InclusionesFlags,
      additionalProperties: false,
    },
    itinerary: properties.itinerary,
    ratings_breakdown: {
      ...bookingDefinitions.RatingsBreakdown,
      additionalProperties: false,
    },
    accessibility: properties.accessibility,
    permite_paquete: properties.permite_paquete,
    schedule_times: {
      type: 'array',
      uniqueItems: true,
      maxItems: 96,
      items: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]:00$' },
    },
  },
  $defs: bookingDefinitions,
};

const nullableString = (maxLength: number) => ({
  type: ['string', 'null'],
  maxLength,
});
const attractionProperties = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  slug: nullableString(220),
  description: { type: 'string', minLength: 1 },
  short_description: nullableString(280),
  type: {
    enum: ['GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE'],
  },
  latitude: { type: 'number', minimum: -90, maximum: 90 },
  longitude: { type: 'number', minimum: -180, maximum: 180 },
  address: nullableString(255),
  meeting_point: nullableString(255),
  duration_hours: { type: 'number', exclusiveMinimum: 0, maximum: 720 },
  currency: { type: 'string', pattern: '^[A-Z]{3}$' },
  city_id: { type: 'integer', minimum: 1, maximum: 32767 },
  operator_id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
  free_cancellation: { type: 'boolean' },
  cancellation_hours: { type: 'integer', minimum: 0, maximum: 32767 },
  featured: { type: 'boolean' },
};
export const createAttractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: attractionProperties,
  required: [
    'name',
    'description',
    'type',
    'latitude',
    'longitude',
    'duration_hours',
    'city_id',
    'operator_id',
  ],
};
export const updateAttractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: attractionProperties,
};

export interface BookingSearch {
  query?: string;
  ciudad?: string;
  city?: string;
  categoria_id?: string;
  incluye_comida?: boolean;
  incluye_transporte?: boolean;
  incluye_guia?: boolean;
  precio_min?: number;
  precio_max?: number;
  duracion_max_horas?: number;
  idioma_guia?: string;
  accesible_silla_ruedas?: boolean;
  animales_asistencia?: boolean;
  cancelacion_gratuita?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  adult_count?: number;
  cantidad_adultos?: number;
  page?: number;
  limit?: number;
  sort?: 'PRICE_ASC' | 'PRICE_DESC' | 'RATING_DESC' | 'POPULARITY';
}
