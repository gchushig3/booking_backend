import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { inventoryGrpcOptions } from '@booking/infrastructure';
import { firstValueFrom, timeout } from 'rxjs';
import type { Observable } from 'rxjs';
import type { SagaLine } from '@booking/infrastructure';

@Injectable()
export class InventoryClient implements OnApplicationShutdown {
  private readonly client: ClientGrpc & { close(): void };
  constructor(private readonly config: ConfigService) {
    this.client = ClientProxyFactory.create(
      inventoryGrpcOptions(config),
    ) as unknown as ClientGrpc & { close(): void };
  }
  async check(line: SagaLine): Promise<number> {
    try {
      const service = this.client.getService<{
        getSlotAvailability(
          input: object,
        ): Observable<{ availableUnits: number }>;
      }>('InventoryStockService');
      const response = await firstValueFrom(
        service
          .getSlotAvailability({
            serviceId: line.serviceId,
            itemId: line.itemId,
            date: line.date,
            timeSlot: line.timeSlot,
            slotId: line.slotId,
          })
          .pipe(timeout(3000)),
      );
      if (
        !Number.isSafeInteger(response.availableUnits) ||
        response.availableUnits < 0
      )
        throw new Error('Invalid availability');
      return response.availableUnits;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 3)
          throw new BadRequestException('Invalid slot identity');
        if (error.code === 5) throw new ConflictException('Slot unavailable');
      }
      throw new ServiceUnavailableException('Inventory unavailable');
    }
  }
  onApplicationShutdown() {
    this.client.close();
  }
}
