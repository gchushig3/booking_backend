// Generado desde contracts/atracciones-openapi-v3.yaml. No editar manualmente.
export const bookingDefinitions = {
  SearchAtraccionesRequestV2: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Término de búsqueda libre o nombre de destino (ej. "Quito", "Mitad del Mundo").',
      },
      ciudad: {
        type: 'string',
        description: 'Ciudad geográfica de destino.',
      },
      fecha_inicio: {
        type: 'string',
        format: 'date',
        description:
          'Fecha de inicio de la experiencia turística (`YYYY-MM-DD`).',
      },
      fecha_fin: {
        type: 'string',
        format: 'date',
        description:
          'Fecha final para rangos de búsqueda flexible (`YYYY-MM-DD`).',
      },
      categoria_id: {
        type: 'string',
        description: 'Filtrar por identificador de categoría o subcategoría.',
      },
      incluye_comida: {
        type: 'boolean',
        description:
          'Filtrar únicamente experiencias que incluyan alimentación.',
      },
      incluye_transporte: {
        type: 'boolean',
        description: 'Filtrar únicamente experiencias que incluyan transporte.',
      },
      incluye_guia: {
        type: 'boolean',
        description:
          'Filtrar únicamente experiencias que cuenten con guía certificado.',
      },
      precio_min: {
        type: 'number',
        minimum: 0,
        description: 'Precio mínimo en USD por adulto.',
      },
      precio_max: {
        type: 'number',
        description: 'Precio máximo en USD por adulto.',
      },
      duracion_max_horas: {
        type: 'integer',
        description:
          'Límite de duración en horas (ej. 4 para tours de medio día).',
      },
      idioma_guia: {
        type: 'string',
        description:
          'Idioma requerido del guía (ej. "Español", "Inglés", "Francés").',
      },
      accesible_silla_ruedas: {
        type: 'boolean',
        description:
          'Filtro de accesibilidad universal para personas en silla de ruedas.',
      },
      animales_asistencia: {
        type: 'boolean',
        description:
          'Filtro de admisión obligatoria de animales de asistencia o lazarillos.',
      },
      cancelacion_gratuita: {
        type: 'boolean',
        description:
          'Filtro de tours con cancelación sin costo hasta 24 horas antes.',
      },
      adult_count: {
        type: 'integer',
        default: 1,
        minimum: 1,
        description:
          'Cantidad de personas adultas para cotizar disponibilidad.',
      },
      cantidad_adultos: {
        type: 'integer',
        default: 1,
        minimum: 1,
        description:
          'Alias canónico en español para cantidad de adultos solicitados.',
      },
      page: {
        type: 'integer',
        default: 1,
        minimum: 1,
      },
      limit: {
        type: 'integer',
        default: 10,
        maximum: 50,
      },
    },
  },
  PaginationMetadata: {
    type: 'object',
    required: ['total_results', 'page', 'limit', 'total_pages'],
    properties: {
      total_results: {
        type: 'integer',
      },
      page: {
        type: 'integer',
      },
      limit: {
        type: 'integer',
      },
      total_pages: {
        type: 'integer',
      },
      next_cursor: {
        type: ['string', 'null'],
      },
    },
  },
  AtraccionCardResponseV2: {
    type: 'object',
    required: [
      'id',
      'name',
      'city',
      'price',
      'rating',
      'duration',
      'inclusions',
    ],
    properties: {
      id: {
        type: 'string',
        description:
          'Identificador único público (ej. ID alfanumérico de Dilan o UUID).',
      },
      slug: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      short_description: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      duration: {
        type: 'string',
      },
      duration_hours: {
        type: 'number',
      },
      price: {
        $ref: '#/$defs/TarifaBaseDesglosada',
      },
      rating: {
        $ref: '#/$defs/RatingResumen',
      },
      free_cancellation: {
        type: 'boolean',
        description:
          'Indica si el tour admite cancelación gratuita sin penalidad.',
      },
      free_cancellation_hours: {
        type: 'integer',
        description: 'Plazo de horas de antelación para cancelar gratis.',
      },
      inclusions: {
        $ref: '#/$defs/InclusionesFlags',
      },
      meeting_point: {
        type: 'string',
      },
      photos: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      permite_paquete: {
        type: 'boolean',
        description:
          'Bandera que habilita el armado de paquetes y combos turísticos con descuento en Booking.',
      },
      nombre: {
        type: 'string',
        description: 'Alias canónico en español para nombre de la atracción.',
      },
      descripcion_corta: {
        type: 'string',
        description: 'Alias canónico en español para descripción corta.',
      },
      ciudad: {
        type: 'string',
        description: 'Alias canónico en español para ciudad.',
      },
      duracion: {
        type: 'string',
        description: 'Alias canónico en español para duración estimada.',
      },
      precio: {
        $ref: '#/$defs/TarifaBaseDesglosada',
        description: 'Alias canónico en español para tarifa base desglosada.',
      },
      calificacion: {
        $ref: '#/$defs/RatingResumen',
        description: 'Alias canónico en español para calificación resumida.',
      },
      cancelacion_gratuita: {
        type: 'boolean',
        description:
          'Alias canónico en español para bandera de cancelación gratuita.',
      },
      inclusiones: {
        $ref: '#/$defs/InclusionesFlags',
        description:
          'Alias canónico en español para banderas de inclusión obligatorias.',
      },
      punto_encuentro: {
        type: 'string',
        description: 'Alias canónico en español para punto de encuentro.',
      },
    },
  },
  TarifaBaseDesglosada: {
    type: 'object',
    required: ['currency', 'adult', 'child', 'senior', 'infant'],
    properties: {
      currency: {
        type: 'string',
      },
      adult: {
        type: 'number',
        description: 'Tarifa completa de adulto (13 a 64 años).',
      },
      child: {
        type: 'number',
        description:
          'Tarifa para niños (5 a 12 años, típicamente con 50% descuento).',
      },
      senior: {
        type: 'number',
        description: 'Tarifa preferencial para adultos mayores (65+ años).',
      },
      infant: {
        type: 'number',
        description:
          'Tarifa de infantes/bebés (0 a 4 años, tarifa $0.00 pero ocupa cupo de aforo).',
      },
      student: {
        type: 'number',
        description:
          'Tarifa preferencial para estudiantes acreditados con carnet (descuento típico 25%).',
      },
      adulto: {
        type: 'number',
        description: 'Alias canónico en español para tarifa de adulto.',
      },
      nino: {
        type: 'number',
        description: 'Alias canónico en español para tarifa de niño.',
      },
      tercera_edad: {
        type: 'number',
        description: 'Alias canónico en español para tarifa de adulto mayor.',
      },
      infante: {
        type: 'number',
        description:
          'Alias canónico en español para tarifa de infante/bebé ($0.00).',
      },
      estudiante: {
        type: 'number',
        description: 'Alias canónico en español para tarifa de estudiante.',
      },
      moneda: {
        type: 'string',
        description: 'Alias canónico en español para código de divisa (USD).',
      },
    },
  },
  RatingResumen: {
    type: 'object',
    required: ['score', 'review_count'],
    properties: {
      score: {
        type: 'number',
      },
      review_count: {
        type: 'integer',
      },
      badge_text: {
        type: 'string',
      },
    },
  },
  InclusionesFlags: {
    type: 'object',
    required: ['includes_food', 'includes_transport', 'includes_guide'],
    properties: {
      includes_food: {
        type: 'boolean',
        description: 'Whether food/snacks/tastings are included.',
      },
      includes_transport: {
        type: 'boolean',
        description: 'Whether ground/panoramic transport is included.',
      },
      includes_guide: {
        type: 'boolean',
        description: 'Whether certified official guide service is included.',
      },
      incluye_comida: {
        type: 'boolean',
        description: 'Alias en español para retrocompatibilidad.',
      },
      incluye_transporte: {
        type: 'boolean',
        description: 'Alias en español para retrocompatibilidad.',
      },
      incluye_guia: {
        type: 'boolean',
        description: 'Alias en español para retrocompatibilidad.',
      },
    },
  },
  SearchAtraccionesResponseV2: {
    type: 'object',
    required: ['metadata', 'data'],
    properties: {
      request_id: {
        type: 'string',
      },
      metadata: {
        $ref: '#/$defs/PaginationMetadata',
      },
      data: {
        type: 'array',
        items: {
          $ref: '#/$defs/AtraccionCardResponseV2',
        },
      },
    },
  },
  RatingCompletoDesglosado: {
    type: 'object',
    required: ['score', 'review_count', 'breakdown'],
    properties: {
      score: {
        type: 'number',
      },
      review_count: {
        type: 'integer',
      },
      badge_text: {
        type: 'string',
      },
      breakdown: {
        $ref: '#/$defs/RatingsBreakdown',
      },
    },
  },
  RatingsBreakdown: {
    type: 'object',
    description: 'Desglose analítico de opiniones por pilares de calidad.',
    required: ['limpieza', 'servicio', 'calidad_precio', 'puntualidad'],
    properties: {
      limpieza: {
        type: 'number',
        description:
          'Calificación de higiene y desinfección en unidades (1 a 10).',
      },
      servicio: {
        type: 'number',
        description:
          'Calificación de la atención del guía y personal de apoyo (1 a 10).',
      },
      calidad_precio: {
        type: 'number',
        description:
          'Relación entre lo pagado y la experiencia vivida (1 a 10).',
      },
      puntualidad: {
        type: 'number',
        description:
          'Cumplimiento de los horarios programados del itinerario (1 a 10).',
      },
      cleanliness: {
        type: 'number',
        description: 'English alias for cleanliness rating score.',
      },
      service_score: {
        type: 'number',
        description: 'English alias for customer service rating score.',
      },
      value_for_money: {
        type: 'number',
        description: 'English alias for quality-to-price ratio score.',
      },
      punctuality: {
        type: 'number',
        description: 'English alias for itinerary punctuality score.',
      },
    },
  },
  ItineraryStop: {
    type: 'object',
    required: ['stop_number', 'time', 'title', 'duration_minutes'],
    properties: {
      stop_number: {
        type: 'integer',
      },
      time: {
        type: 'string',
        description: 'Hora de inicio programada del hito o parada.',
      },
      title: {
        type: 'string',
      },
      description: {
        type: 'string',
      },
      duration_minutes: {
        type: 'integer',
        description: 'Duración estimada en minutos de la parada o actividad.',
      },
      location_name: {
        type: 'string',
      },
      numero_parada: {
        type: 'integer',
        description:
          'Alias canónico en español para orden secuencial de la parada.',
      },
      hora: {
        type: 'string',
        description: 'Alias canónico en español para hora programada.',
      },
      titulo: {
        type: 'string',
        description: 'Alias canónico en español para título de la parada.',
      },
      descripcion: {
        type: 'string',
        description:
          'Alias canónico en español para descripción de actividades en la parada.',
      },
      duracion_minutos: {
        type: 'integer',
        description:
          'Alias canónico en español para duración estimada en minutos.',
      },
      nombre_ubicacion: {
        type: 'string',
        description: 'Alias canónico en español para referencia del lugar.',
      },
    },
  },
  MeetingPointGeo: {
    type: 'object',
    required: ['address', 'city', 'latitude', 'longitude'],
    properties: {
      address: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      latitude: {
        type: 'number',
      },
      longitude: {
        type: 'number',
      },
      arrival_instructions: {
        type: 'string',
      },
      google_maps_url: {
        type: 'string',
      },
      direccion: {
        type: 'string',
        description: 'Alias canónico en español para dirección física.',
      },
      ciudad: {
        type: 'string',
        description: 'Alias canónico en español para ciudad.',
      },
      latitud: {
        type: 'number',
        description:
          'Alias canónico en español para coordenada GPS de latitud.',
      },
      longitud: {
        type: 'number',
        description:
          'Alias canónico en español para coordenada GPS de longitud.',
      },
      instrucciones_llegada: {
        type: 'string',
        description: 'Alias canónico en español para pautas de encuentro.',
      },
    },
  },
  AccessibilityAttributes: {
    type: 'object',
    properties: {
      wheelchair_accessible: {
        type: 'boolean',
        description: 'Apto para personas en silla de ruedas en bus y paradas.',
      },
      stroller_accessible: {
        type: 'boolean',
        description: 'Apto para carriolas de bebés.',
      },
      service_animals_allowed: {
        type: 'boolean',
        description:
          'Admisión de perros guía y animales de asistencia según normativa.',
      },
      accesible_silla_ruedas: {
        type: 'boolean',
        description:
          'Alias canónico en español para accesibilidad en silla de ruedas.',
      },
      accesible_carriola: {
        type: 'boolean',
        description:
          'Alias canónico en español para aptitud de carriolas infantiles.',
      },
      admite_animales_asistencia: {
        type: 'boolean',
        description:
          'Alias canónico en español para ingreso de animales de servicio.',
      },
    },
  },
  CancellationPolicy: {
    type: 'object',
    required: ['free_cancellation', 'deadline_hours'],
    properties: {
      free_cancellation: {
        type: 'boolean',
      },
      deadline_hours: {
        type: 'integer',
        description:
          'Horas mínimas previas al inicio para cancelar sin penalidad.',
      },
      description: {
        type: 'string',
      },
      cancelacion_gratuita: {
        type: 'boolean',
        description:
          'Alias canónico en español para cancelación gratuita sin recargo.',
      },
      horas_limite: {
        type: 'integer',
        description:
          'Alias canónico en español para plazo de horas previas de antelación.',
      },
      descripcion: {
        type: 'string',
        description:
          'Alias canónico en español para descripción de la política.',
      },
    },
  },
  ProveedorInfo: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
      },
      nombre_comercial: {
        type: 'string',
      },
      ruc: {
        type: 'string',
      },
      telefono_emergencia: {
        type: 'string',
      },
      email_soporte: {
        type: 'string',
      },
    },
  },
  AtraccionDetailResponseV2: {
    type: 'object',
    required: [
      'id',
      'name',
      'description',
      'city',
      'price',
      'rating',
      'inclusions',
      'itinerary',
      'meeting_point_geo',
    ],
    properties: {
      id: {
        type: 'string',
      },
      uuid: {
        type: 'string',
        format: 'uuid',
      },
      slug: {
        type: 'string',
      },
      name: {
        type: 'string',
      },
      description: {
        type: 'string',
      },
      city: {
        type: 'string',
      },
      duration: {
        type: 'string',
      },
      price: {
        $ref: '#/$defs/TarifaBaseDesglosada',
      },
      rating: {
        $ref: '#/$defs/RatingCompletoDesglosado',
      },
      inclusions: {
        $ref: '#/$defs/InclusionesFlags',
      },
      inclusions_list: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      exclusions_list: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      itinerary: {
        type: 'array',
        description: 'Secuencia cronológica paso a paso del recorrido.',
        items: {
          $ref: '#/$defs/ItineraryStop',
        },
      },
      meeting_point_geo: {
        $ref: '#/$defs/MeetingPointGeo',
      },
      accessibility: {
        $ref: '#/$defs/AccessibilityAttributes',
      },
      guide_languages: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      cancellation_policy: {
        $ref: '#/$defs/CancellationPolicy',
      },
      permite_paquete: {
        type: 'boolean',
      },
      porcentaje_descuento_paquete: {
        type: 'number',
        description:
          'Descuento comercial máximo otorgado por el socio para combos turísticos.',
      },
      photos: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      proveedor: {
        $ref: '#/$defs/ProveedorInfo',
      },
      nombre: {
        type: 'string',
        description: 'Alias canónico en español para nombre de la atracción.',
      },
      descripcion: {
        type: 'string',
        description: 'Alias canónico en español para descripción completa.',
      },
      ciudad: {
        type: 'string',
        description: 'Alias canónico en español para ciudad.',
      },
      duracion: {
        type: 'string',
        description: 'Alias canónico en español para duración estimada.',
      },
      precio: {
        $ref: '#/$defs/TarifaBaseDesglosada',
        description: 'Alias canónico en español para tarifa base desglosada.',
      },
      calificacion: {
        $ref: '#/$defs/RatingCompletoDesglosado',
        description: 'Alias canónico en español para calificación desglosada.',
      },
      inclusiones: {
        $ref: '#/$defs/InclusionesFlags',
        description:
          'Alias canónico en español para banderas de inclusión obligatorias.',
      },
      punto_encuentro_geo: {
        $ref: '#/$defs/MeetingPointGeo',
        description:
          'Alias canónico en español para coordenadas y datos del punto de encuentro.',
      },
      itinerario: {
        type: 'array',
        items: {
          $ref: '#/$defs/ItineraryStop',
        },
        description: 'Alias canónico en español para itinerario paso a paso.',
      },
      accesibilidad: {
        $ref: '#/$defs/AccessibilityAttributes',
        description:
          'Alias canónico en español para atributos de accesibilidad.',
      },
      politica_cancelacion: {
        $ref: '#/$defs/CancellationPolicy',
        description: 'Alias canónico en español para política de cancelación.',
      },
    },
  },
  CategoryFlat: {
    type: 'object',
    required: ['id', 'nombre', 'slug'],
    properties: {
      id: {
        type: 'string',
      },
      padre_id: {
        type: ['string', 'null'],
        description:
          'Identificador de la categoría padre (null si es categoría raíz).',
      },
      nombre: {
        type: 'string',
      },
      slug: {
        type: 'string',
      },
      incluye_comida: {
        type: 'boolean',
      },
      incluye_transporte: {
        type: 'boolean',
      },
      incluye_guia: {
        type: 'boolean',
      },
    },
  },
  CategoryTreeNode: {
    type: 'object',
    required: [
      'id',
      'nombre',
      'slug',
      'incluye_comida',
      'incluye_transporte',
      'incluye_guia',
    ],
    properties: {
      id: {
        type: 'string',
        description: 'Identificador único de la categoría.',
      },
      nombre: {
        type: 'string',
        description: 'Nombre legible de la categoría.',
      },
      slug: {
        type: 'string',
        description: 'Identificador web URL-friendly.',
      },
      descripcion: {
        type: 'string',
        description: 'Resumen descriptivo de las actividades de este grupo.',
      },
      icono: {
        type: 'string',
        description:
          'Nombre del icono para la interfaz gráfica (FontAwesome o Lucide).',
      },
      incluye_comida: {
        type: 'boolean',
        description:
          'Bandera booleana obligatoria. Indica si las actividades de esta categoría incluyen alimentación.',
      },
      incluye_transporte: {
        type: 'boolean',
        description:
          'Bandera booleana obligatoria. Indica si incluye traslado vehicular.',
      },
      incluye_guia: {
        type: 'boolean',
        description:
          'Bandera booleana obligatoria. Indica si incluye acompañamiento de guía profesional.',
      },
      orden: {
        type: 'integer',
        description: 'Posición ordinal de renderizado en el menú.',
      },
      subcategorias: {
        type: 'array',
        description: 'Lista anidada recursiva de subcategorías hijas.',
        items: {
          $ref: '#/$defs/CategoryTreeNode',
        },
      },
    },
  },
};
export const bookingListParameters = [
  {
    name: 'city',
    in: 'query',
    required: false,
    description:
      'Nombre de la ciudad turística (ej. Quito, Baños, Cuenca, Galápagos).',
    schema: {
      type: 'string',
    },
    example: 'Quito',
  },
  {
    name: 'categoria_id',
    in: 'query',
    required: false,
    description: 'Identificador de la categoría deseada.',
    schema: {
      type: 'string',
    },
  },
  {
    name: 'incluye_comida',
    in: 'query',
    required: false,
    description: 'Filtrar solo atracciones que incluyan alimentación.',
    schema: {
      type: 'boolean',
    },
  },
  {
    name: 'incluye_transporte',
    in: 'query',
    required: false,
    description: 'Filtrar solo atracciones que incluyan traslado.',
    schema: {
      type: 'boolean',
    },
  },
  {
    name: 'incluye_guia',
    in: 'query',
    required: false,
    description: 'Filtrar solo experiencias con guía acreditado.',
    schema: {
      type: 'boolean',
    },
  },
  {
    name: 'page',
    in: 'query',
    required: false,
    description: 'Número de página (1-indexed).',
    schema: {
      type: 'integer',
      default: 1,
      minimum: 1,
    },
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    description: 'Cantidad de resultados por página.',
    schema: {
      type: 'integer',
      default: 10,
      maximum: 50,
    },
  },
  {
    name: 'sort',
    in: 'query',
    required: false,
    description: 'Criterio de ordenamiento.',
    schema: {
      type: 'string',
      enum: ['PRICE_ASC', 'PRICE_DESC', 'RATING_DESC', 'POPULARITY'],
      default: 'POPULARITY',
    },
  },
];
export function bookingSchema(name: keyof typeof bookingDefinitions): object {
  return { $ref: `#/$defs/${name}`, $defs: bookingDefinitions };
}
