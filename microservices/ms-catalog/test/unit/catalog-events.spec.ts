import 'reflect-metadata';
import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { ConfirmedEventPublisher } from '@booking/infrastructure';
import { CatalogEventsService } from '../../src/booking/catalog-events.service.js';

describe('Eventos de consulta de atracciones', () => {
  it('propaga correlacion y espera confirmacion del publicador CloudAMQP', async () => {
    const publish = jest
      .fn<ConfirmedEventPublisher['publish']>()
      .mockResolvedValue(undefined);
    const service = new CatalogEventsService(
      { publish } as unknown as ConfirmedEventPublisher,
      new ConfigService({ CATALOG_EVENTS_QUEUE: 'booking.catalog.events' }),
    );
    await service.consulted('attraction-uuid', 'correlation-123');
    expect(publish).toHaveBeenCalledWith(
      'booking.catalog.events',
      expect.objectContaining({
        tipo: 'atraccion.consultada',
        origen: 'ms_catalog',
        correlationId: 'correlation-123',
        data: { atraccionId: 'attraction-uuid' },
      }),
    );
    publish.mockRejectedValueOnce(new Error('offline'));
    await expect(service.consulted('attraction-uuid')).rejects.toMatchObject({
      status: 503,
    });
  });
});
