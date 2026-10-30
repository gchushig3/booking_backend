import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmedEventPublisher } from '@booking/infrastructure';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CatalogEventsService {
  constructor(
    private readonly publisher: ConfirmedEventPublisher,
    private readonly config: ConfigService,
  ) {}

  async consulted(id: string, correlationId?: string) {
    try {
      await this.publisher.publish(
        this.config.getOrThrow<string>('CATALOG_EVENTS_QUEUE'),
        {
          eventoId: randomUUID(),
          tipo: 'atraccion.consultada',
          fechaISO: new Date().toISOString(),
          origen: 'ms_catalog',
          correlationId: correlationId ?? randomUUID(),
          data: { atraccionId: id },
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible confirmar atraccion.consultada',
      );
    }
  }
}
