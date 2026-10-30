import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import type { Repository } from 'typeorm';
import { JsonSchemaValidationPipe } from '@booking/infrastructure';
import { BookingCatalogService } from '../../src/booking/booking-catalog.service.js';
import { BookingProfileEntity } from '../../src/booking/booking-profile.entity.js';
import { AtraccionEntity } from '../../src/database/entities/atraccion.entity.js';
import { CategoriaEntity } from '../../src/database/entities/categoria.entity.js';
import { InventoryAvailabilityService } from '../../src/booking/inventory-availability.service.js';
import { bookingSchema } from '../../src/booking/contract-schemas.js';
import { profileSchema } from '../../src/booking/booking.schemas.js';

const fixture = Object.assign(new AtraccionEntity(), {
  atr_id: '1',
  atr_uuid: '72854a89-5f2b-4c42-8802-3a976cd2db6b',
  atr_nombre: 'Quito',
  atr_slug: 'quito',
  atr_descripcion: 'Tour',
  atr_duracion_horas: '2.00',
  atr_latitud: '-0.2',
  atr_longitud: '-78.5',
  atr_calificacion_promedio: '4.50',
  atr_numero_resenas: 2,
  atr_cancelacion_gratuita: true,
  atr_horas_cancelacion: 24,
  fotos: [],
  idiomas: [],
  booking: {
    payload: {
      city: 'Quito',
      price: { currency: 'USD', adult: 20, child: 10, senior: 15, infant: 0 },
      inclusions: {
        includes_food: false,
        includes_transport: true,
        includes_guide: true,
      },
      itinerary: [],
      ratings_breakdown: {
        limpieza: 9,
        servicio: 9,
        calidad_precio: 8,
        puntualidad: 9,
      },
      schedule_times: ['10:30:00'],
    },
  },
});

describe('Catalogo contractual Booking', () => {
  function setup() {
    const qb = {
      leftJoinAndSelect: jest.fn(),
      innerJoinAndMapOne: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      addSelect: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getOne: jest.fn(() => Promise.resolve(fixture)),
      getMany: jest.fn(() => Promise.resolve([fixture])),
      getManyAndCount: jest.fn(() => Promise.resolve([[fixture], 1])),
    };
    for (const key of [
      'leftJoinAndSelect',
      'innerJoinAndMapOne',
      'where',
      'andWhere',
      'addSelect',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ] as const)
      qb[key].mockReturnValue(qb);
    const inventory = {
      available: jest
        .fn<
          (
            itemId: string,
            date: string,
            time: string,
            count: number,
          ) => Promise<boolean>
        >()
        .mockResolvedValue(true),
    };
    const service = new BookingCatalogService(
      {
        createQueryBuilder: () => qb,
      } as unknown as Repository<AtraccionEntity>,
      {} as Repository<BookingProfileEntity>,
      {} as Repository<CategoriaEntity>,
      inventory as unknown as InventoryAvailabilityService,
    );
    return { service, qb, inventory };
  }

  it('detalle y busqueda cumplen los esquemas derivados del YAML inmutable', async () => {
    const { service } = setup();
    const detail = await service.detail('quito');
    expect(() =>
      new JsonSchemaValidationPipe(
        bookingSchema('AtraccionDetailResponseV2'),
      ).transform(detail),
    ).not.toThrow();
    const result = await service.search({
      ciudad: 'Quito',
      incluye_comida: false,
      limit: 10,
    });
    expect(() =>
      new JsonSchemaValidationPipe(
        bookingSchema('SearchAtraccionesResponseV2'),
      ).transform(result),
    ).not.toThrow();
  });

  it('rechaza perfiles sin tarifas e itinerarios, fechas invertidas y limites fuera del contrato', async () => {
    expect(() =>
      new JsonSchemaValidationPipe(profileSchema).transform({ city: 'Quito' }),
    ).toThrow();
    const { service } = setup();
    await expect(service.search({ limit: 51 })).rejects.toThrow();
    await expect(
      service.search({ precio_min: 20, precio_max: 1 }),
    ).rejects.toThrow();
    await expect(
      service.search({ fecha_inicio: '2026-11-02', fecha_fin: '2026-11-01' }),
    ).rejects.toThrow();
  });

  it('filtra disponibilidad por gRPC antes de calcular total y paginar', async () => {
    const { service, inventory } = setup();
    inventory.available.mockResolvedValueOnce(false);
    const response = await service.search({
      fecha_inicio: '2026-11-01',
      cantidad_adultos: 3,
    });
    expect(inventory.available).toHaveBeenCalledWith(
      fixture.atr_uuid,
      '2026-11-01',
      '10:30:00',
      3,
    );
    expect(response.metadata.total_results).toBe(0);
    expect(response.data).toEqual([]);
  });
});
