import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  GrpcMethod,
  GrpcStreamMethod,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import {
  InfrastructureRoles,
  JsonSchemaValidationPipe,
  bigintIdSchema,
  consumeSaga,
  sagaBindings,
  sagaHash,
} from '@booking/infrastructure';
import type { SagaHttpRequest } from '@booking/infrastructure';
import { Metadata, status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Observable, concatMap, from, reduce, map } from 'rxjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { InventoryService } from './inventory.service.js';
import { InventorySagaService } from './inventory-saga.service.js';
import type { SlotKey, StockUpdate, StockDelta } from './slot.js';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly saga: InventorySagaService,
    private readonly config: ConfigService,
  ) {}
  private authenticate(metadata: Metadata) {
    const expected = this.config.getOrThrow<string>('INVENTORY_SYNC_API_KEY');
    const provided = metadata.get('x-api-key')[0];
    if (
      expected.length < 32 ||
      typeof provided !== 'string' ||
      provided.length > 4096 ||
      !timingSafeEqual(
        createHash('sha256').update(expected).digest(),
        createHash('sha256').update(provided).digest(),
      )
    ) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid inventory sync key',
      });
    }
  }
  @GrpcMethod('InventoryStockService', 'GetSlotAvailability')
  availability(input: SlotKey) {
    return this.service.availability(input);
  }
  @GrpcMethod('InventoryStockService', 'PushStockUpdate')
  snapshot(input: StockUpdate, metadata: Metadata) {
    this.authenticate(metadata);
    return this.service.snapshot(input);
  }
  @GrpcStreamMethod('InventoryStockService', 'StreamInventoryChanges')
  stream(input: Observable<StockDelta>, metadata: Metadata) {
    this.authenticate(metadata);
    let count = 0;
    return input.pipe(
      concatMap((change) => {
        if (++count > 10000)
          throw new RpcException({
            code: status.RESOURCE_EXHAUSTED,
            message: 'Stream too large',
          });
        return from(this.service.delta(change)).pipe(
          map((applied) => ({ applied, hash: sagaHash(change) })),
        );
      }),
      reduce(
        (state, result) => ({
          totalEventsProcessed:
            state.totalEventsProcessed + (result.applied ? 1 : 0),
          isSynchronized: true,
          lastSyncHash: sagaHash([
            state.lastSyncHash,
            result.hash,
            result.applied,
          ]),
        }),
        {
          totalEventsProcessed: 0,
          isSynchronized: true,
          lastSyncHash: sagaHash([]),
        },
      ),
    );
  }
  @InfrastructureRoles('ADMIN')
  @Post('slots')
  register(
    @Req() request: SagaHttpRequest,
    @Headers('idempotency-key') key: string,
    @Body(
      new JsonSchemaValidationPipe({
        type: 'object',
        additionalProperties: false,
        required: ['attractionId', 'itemId', 'date', 'timeSlot', 'capacity'],
        properties: {
          attractionId: bigintIdSchema,
          itemId: { type: 'string', minLength: 1, maxLength: 220 },
          date: { type: 'string', format: 'date' },
          timeSlot: {
            type: 'string',
            pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]:00$',
          },
          capacity: { type: 'integer', minimum: 1, maximum: 2147483647 },
        },
      }),
    )
    body: {
      attractionId: string;
      itemId: string;
      date: string;
      timeSlot: string;
      capacity: number;
    },
  ) {
    if (
      !key ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      )
    )
      throw new BadRequestException('Idempotency-Key UUID required');
    return this.service.register(request.principal.userId, key, body);
  }
  @EventPattern([...sagaBindings.ms_inventory])
  onEvent(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    return consumeSaga(context, payload, (event) => this.saga.event(event));
  }
}
