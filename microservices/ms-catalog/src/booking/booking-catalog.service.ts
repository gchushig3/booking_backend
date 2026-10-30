import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AtraccionEntity } from '../database/entities/atraccion.entity.js';
import { CategoriaEntity } from '../database/entities/categoria.entity.js';
import { BookingProfileEntity } from './booking-profile.entity.js';
import type { BookingProfile } from './booking-profile.entity.js';
import type { BookingSearch } from './booking.schemas.js';
import { InventoryAvailabilityService } from './inventory-availability.service.js';

@Injectable()
export class BookingCatalogService {
  constructor(
    @InjectRepository(AtraccionEntity)
    private readonly attractions: Repository<AtraccionEntity>,
    @InjectRepository(BookingProfileEntity)
    private readonly profiles: Repository<BookingProfileEntity>,
    @InjectRepository(CategoriaEntity)
    private readonly categoryRepo: Repository<CategoriaEntity>,
    private readonly inventory: InventoryAvailabilityService,
  ) {}

  private query() {
    return this.attractions
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.fotos', 'photo')
      .leftJoinAndSelect('a.idiomas', 'ai')
      .leftJoinAndSelect('ai.idioma', 'language')
      .innerJoinAndMapOne(
        'a.booking',
        BookingProfileEntity,
        'p',
        'p.atr_id = a.atr_id',
      )
      .where('a.atr_estado = :status', { status: 'PUBLICADA' })
      .andWhere('a.atr_eliminado_en IS NULL');
  }

  async search(input: BookingSearch, requestId?: string) {
    if (input.fecha_fin && !input.fecha_inicio)
      throw new BadRequestException('fecha_fin requiere fecha_inicio');
    if (
      input.adult_count &&
      input.cantidad_adultos &&
      input.adult_count !== input.cantidad_adultos
    )
      throw new BadRequestException(
        'Alias de cantidad de adultos inconsistentes',
      );
    const dates: string[] = [];
    if (input.fecha_inicio) {
      const end = input.fecha_fin ?? input.fecha_inicio;
      if (
        end < input.fecha_inicio ||
        (Date.parse(end) - Date.parse(input.fecha_inicio)) / 86400000 > 30
      )
        throw new BadRequestException(
          'Rango de fechas invalido o mayor a 31 dias',
        );
      for (
        let day = Date.parse(input.fecha_inicio);
        day <= Date.parse(end);
        day += 86400000
      )
        dates.push(new Date(day).toISOString().slice(0, 10));
    }
    if (
      input.precio_min !== undefined &&
      input.precio_max !== undefined &&
      input.precio_min > input.precio_max
    ) {
      throw new BadRequestException(
        'precio_min debe ser menor o igual a precio_max',
      );
    }
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      throw new BadRequestException('Paginacion invalida');
    }
    const qb = this.query();
    if (input.query)
      qb.andWhere(
        '(a.atr_nombre ILIKE :query OR a.atr_descripcion ILIKE :query)',
        { query: `%${input.query}%` },
      );
    if (input.ciudad || input.city)
      qb.andWhere("lower(p.payload->>'city') = lower(:city)", {
        city: input.ciudad ?? input.city,
      });
    if (input.categoria_id) {
      qb.andWhere(
        `EXISTS (WITH RECURSIVE descendants AS (
        SELECT cat_id FROM categoria WHERE cat_activa AND (cat_id::text = :category OR cat_slug = :category)
        UNION SELECT c.cat_id FROM categoria c JOIN descendants d ON c.cat_padre_id = d.cat_id WHERE c.cat_activa
      ) SELECT 1 FROM atraccion_categoria ac JOIN descendants d ON d.cat_id = ac.cat_id WHERE ac.atr_id = a.atr_id)`,
        { category: input.categoria_id },
      );
    }
    for (const [key, flag] of [
      ['incluye_comida', 'includes_food'],
      ['incluye_transporte', 'includes_transport'],
      ['incluye_guia', 'includes_guide'],
    ] as const) {
      if (input[key] !== undefined)
        qb.andWhere(
          `(p.payload->'inclusions'->>'${flag}')::boolean = :${key}`,
          { [key]: input[key] },
        );
    }
    for (const [key, flag] of [
      ['accesible_silla_ruedas', 'wheelchair_accessible'],
      ['animales_asistencia', 'service_animals_allowed'],
    ] as const) {
      if (input[key] !== undefined)
        qb.andWhere(
          `(p.payload->'accessibility'->>'${flag}')::boolean = :${key}`,
          { [key]: input[key] },
        );
    }
    if (input.precio_min !== undefined)
      qb.andWhere("(p.payload->'price'->>'adult')::numeric >= :min", {
        min: input.precio_min,
      });
    if (input.precio_max !== undefined)
      qb.andWhere("(p.payload->'price'->>'adult')::numeric <= :max", {
        max: input.precio_max,
      });
    if (input.duracion_max_horas !== undefined)
      qb.andWhere('a.atr_duracion_horas <= :hours', {
        hours: input.duracion_max_horas,
      });
    if (input.cancelacion_gratuita !== undefined)
      qb.andWhere('a.atr_cancelacion_gratuita = :cancel', {
        cancel: input.cancelacion_gratuita,
      });
    if (input.idioma_guia)
      qb.andWhere(
        `EXISTS (SELECT 1 FROM atraccion_idioma ai2 JOIN idioma i ON i.idi_id = ai2.idi_id
      WHERE ai2.atr_id = a.atr_id AND (lower(i.idi_nombre) = lower(:lang) OR i.idi_codigo = :lang))`,
        { lang: input.idioma_guia },
      );
    const sort = input.sort ?? 'POPULARITY';
    // Seleccionar el precio como alias mantiene compatible la paginacion DISTINCT de TypeORM con joins.
    qb.addSelect("(p.payload->'price'->>'adult')::numeric", 'booking_price');
    if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC')
      qb.orderBy('booking_price', sort === 'PRICE_ASC' ? 'ASC' : 'DESC');
    else if (sort === 'RATING_DESC')
      qb.orderBy('a.atr_calificacion_promedio', 'DESC');
    else qb.orderBy('a.atr_numero_resenas', 'DESC');
    qb.addOrderBy('a.atr_id', 'ASC');
    let items: AtraccionEntity[];
    let total: number;
    if (!dates.length) {
      [items, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
    } else {
      // Filtrar antes de paginar para que metadata refleje el aforo confirmado.
      const candidates = await qb.getMany();
      const available: AtraccionEntity[] = [];
      for (const candidate of candidates) {
        const times = this.profile(candidate).schedule_times;
        if (!times)
          throw new ServiceUnavailableException(
            'Sincronice schedule_times desde Inventory antes de buscar por fecha',
          );
        let found = false;
        for (const date of dates) {
          for (const time of times) {
            if (
              await this.inventory.available(
                candidate.atr_uuid,
                date,
                time,
                input.cantidad_adultos ?? input.adult_count ?? 1,
              )
            ) {
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) available.push(candidate);
      }
      total = available.length;
      items = available.slice((page - 1) * limit, page * limit);
    }
    return {
      request_id: requestId,
      metadata: {
        total_results: total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      data: items.map((item) => this.card(item)),
    };
  }

  private profile(item: AtraccionEntity): BookingProfile {
    return (item as AtraccionEntity & { booking: BookingProfileEntity }).booking
      .payload;
  }

  card(item: AtraccionEntity) {
    const profile = this.profile(item);
    return {
      id: item.atr_uuid,
      slug: item.atr_slug,
      name: item.atr_nombre,
      nombre: item.atr_nombre,
      short_description: item.atr_descripcion_corta ?? '',
      city: profile.city,
      ciudad: profile.city,
      duration: `${Number(item.atr_duracion_horas)} horas`,
      duration_hours: Number(item.atr_duracion_horas),
      price: profile.price,
      precio: profile.price,
      rating: {
        score: Number(item.atr_calificacion_promedio),
        review_count: item.atr_numero_resenas,
      },
      inclusions: profile.inclusions,
      inclusiones: profile.inclusions,
      free_cancellation: item.atr_cancelacion_gratuita,
      free_cancellation_hours: item.atr_horas_cancelacion,
      photos: [...(item.fotos ?? [])]
        .sort((a, b) => a.fot_orden - b.fot_orden)
        .map((photo) => photo.fot_url),
      ...(profile.permite_paquete === undefined
        ? {}
        : { permite_paquete: profile.permite_paquete }),
    };
  }

  async detail(id: string) {
    const item = await this.query()
      .andWhere(
        '(a.atr_uuid::text = :id OR a.atr_slug = :id OR a.atr_id::text = :id)',
        { id },
      )
      .getOne();
    if (!item)
      throw new NotFoundException(
        'Atraccion publicada con perfil Booking no encontrada',
      );
    const profile = this.profile(item);
    return {
      ...this.card(item),
      uuid: item.atr_uuid,
      description: item.atr_descripcion,
      rating: {
        score: Number(item.atr_calificacion_promedio),
        review_count: item.atr_numero_resenas,
        breakdown: profile.ratings_breakdown,
      },
      itinerary: profile.itinerary,
      meeting_point_geo: {
        address: item.atr_punto_encuentro ?? item.atr_direccion ?? '',
        city: profile.city,
        latitude: Number(item.atr_latitud),
        longitude: Number(item.atr_longitud),
      },
      ...(profile.accessibility
        ? { accessibility: profile.accessibility }
        : {}),
      guide_languages: item.idiomas?.map(
        (relation) => relation.idioma.idi_nombre,
      ),
      cancellation_policy: {
        free_cancellation: item.atr_cancelacion_gratuita,
        deadline_hours: item.atr_horas_cancelacion,
      },
    };
  }

  async saveProfile(id: string, payload: BookingProfile) {
    const item = await this.attractions
      .createQueryBuilder('a')
      .where(
        '(a.atr_id::text = :id OR a.atr_uuid::text = :id OR a.atr_slug = :id)',
        { id },
      )
      .getOne();
    if (!item) throw new NotFoundException('Atraccion no encontrada');
    await this.profiles.upsert(
      { atr_id: item.atr_id, payload, updated_at: new Date() },
      ['atr_id'],
    );
    return { id: item.atr_uuid, ...payload };
  }

  async categories(parent?: string, tree = false) {
    const all = await this.categoryRepo.find({
      where: { cat_activa: true },
      order: { cat_orden: 'ASC', cat_id: 'ASC' },
    });
    const map = (item: CategoriaEntity): Record<string, unknown> => ({
      id: String(item.cat_id),
      nombre: item.cat_nombre,
      slug: item.cat_slug,
      descripcion: item.cat_descripcion ?? '',
      icono: item.cat_icono,
      orden: item.cat_orden,
      padre_id: item.cat_padre_id === null ? null : String(item.cat_padre_id),
      // El SQL oficial no define flags en categoria; son agregados de sus atracciones.
      incluye_comida: flags.get(item.cat_id)?.food ?? false,
      incluye_transporte: flags.get(item.cat_id)?.transport ?? false,
      incluye_guia: flags.get(item.cat_id)?.guide ?? false,
      ...(tree
        ? {
            subcategorias: all
              .filter((child) => child.cat_padre_id === item.cat_id)
              .map(map),
          }
        : {}),
    });
    const rows = await this.profiles.query<
      Array<{
        cat_id: number;
        food: boolean;
        transport: boolean;
        guide: boolean;
      }>
    >(`SELECT ac.cat_id,
      bool_or((p.payload->'inclusions'->>'includes_food')::boolean) AS food,
      bool_or((p.payload->'inclusions'->>'includes_transport')::boolean) AS transport,
      bool_or((p.payload->'inclusions'->>'includes_guide')::boolean) AS guide
      FROM atraccion_categoria ac JOIN booking_attraction_profile p USING (atr_id)
      JOIN atraccion a USING (atr_id) WHERE a.atr_estado = 'PUBLICADA' AND a.atr_eliminado_en IS NULL GROUP BY ac.cat_id`);
    const flags = new Map(rows.map((row) => [row.cat_id, row]));
    return all
      .filter((item) =>
        parent === undefined
          ? item.cat_padre_id === null
          : String(item.cat_padre_id) === parent,
      )
      .map(map);
  }
}
