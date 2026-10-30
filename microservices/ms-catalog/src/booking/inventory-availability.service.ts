import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { inventoryGrpcOptions } from '@booking/infrastructure';
import { firstValueFrom, timeout } from 'rxjs';
import type { Observable } from 'rxjs';

interface InventoryClient {
  getSlotAvailability(request: {
    serviceId: string;
    itemId: string;
    date: string;
    timeSlot: string;
    slotId: string;
  }): Observable<{ availableUnits: number; status: string }>;
}

@Injectable()
export class InventoryAvailabilityService implements OnApplicationShutdown {
  private client?: ClientGrpc & { close(): void };
  private service?: InventoryClient;
  constructor(private readonly config: ConfigService) {}

  async available(
    itemId: string,
    date: string,
    time: string,
    count: number,
  ): Promise<boolean> {
    try {
      if (!this.service) {
        this.client = ClientProxyFactory.create(
          inventoryGrpcOptions(this.config),
        ) as unknown as ClientGrpc & { close(): void };
        this.service = this.client.getService<InventoryClient>(
          'InventoryStockService',
        );
      }
      const hour = Number(time.slice(0, 2));
      const timeSlot = `${hour % 12 || 12}:${time.slice(3, 5)} ${hour < 12 ? 'a.m.' : 'p.m.'}`;
      const result = await firstValueFrom(
        this.service
          .getSlotAvailability({
            serviceId: this.config.getOrThrow<string>('INVENTORY_SERVICE_ID'),
            itemId,
            date,
            timeSlot,
            slotId: `slot-${date.replaceAll('-', '')}-${time.slice(0, 5).replace(':', '')}`,
          })
          .pipe(timeout(3000)),
      );
      return (
        Number.isInteger(result.availableUnits) &&
        result.availableUnits >= count &&
        result.status !== 'AGOTADO'
      );
    } catch {
      throw new ServiceUnavailableException(
        'Inventory no disponible para confirmar aforo',
      );
    }
  }

  onApplicationShutdown() {
    this.client?.close();
  }
}
