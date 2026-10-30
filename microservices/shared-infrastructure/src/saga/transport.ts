import {
  DynamicModule,
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RmqOptions, Transport, RmqContext } from "@nestjs/microservices";
import { DataSource } from "typeorm";
import { connect } from "amqp-connection-manager";
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import {
  sagaBindings,
  validateSagaEvent,
  PermanentSagaError,
} from "./contracts.js";
import type { SagaServiceName, SagaEvent } from "./contracts.js";
import type { DomainEvent } from "../rabbitmq.module.js";
import { SAGA_SERVICE, SagaStore } from "./store.js";

function brokerUrl(config: ConfigService): string {
  const url = config.getOrThrow<string>("AMQP_URL");
  if (new URL(url).protocol !== "amqps:")
    throw new Error("AMQP_URL requires AMQPS");
  return url;
}
const exchangeName = (config: ConfigService) =>
  config.get<string>("SAGA_EXCHANGE") ?? "booking.saga.v1";
export const sagaQueue = (config: ConfigService, role: SagaServiceName) =>
  `${exchangeName(config)}.${role}`;
export function sagaRmqOptions(
  config: ConfigService,
  role: SagaServiceName,
): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [brokerUrl(config)],
      queue: sagaQueue(config, role),
      queueOptions: {
        durable: true,
        deadLetterExchange: `${exchangeName(config)}.dead`,
      },
      noAck: false,
      prefetchCount: 10,
      persistent: true,
    },
  };
}

@Injectable()
export class SagaBus implements OnApplicationShutdown {
  private readonly connection: AmqpConnectionManager;
  private readonly channel: ChannelWrapper;
  constructor(private readonly config: ConfigService) {
    this.connection = connect([brokerUrl(config)]);
    this.channel = this.connection.createChannel({
      confirm: true,
      setup: async (channel: ConfirmChannel) => {
        const exchange = exchangeName(config);
        await channel.assertExchange(exchange, "topic", { durable: true });
        await channel.assertExchange(`${exchange}.dead`, "fanout", {
          durable: true,
        });
        await channel.assertQueue(`${exchange}.dead`, { durable: true });
        await channel.bindQueue(`${exchange}.dead`, `${exchange}.dead`, "");
        // Declarar todos los destinos antes del primer publish evita perder eventos por orden de arranque.
        for (const [role, bindings] of Object.entries(sagaBindings)) {
          const queue = sagaQueue(config, role as SagaServiceName);
          await channel.assertQueue(queue, {
            durable: true,
            deadLetterExchange: `${exchange}.dead`,
          });
          for (const key of bindings)
            await channel.bindQueue(queue, exchange, key);
        }
        const auditQueue = config.get<string>("AMQP_AUDIT_QUEUE");
        if (auditQueue) {
          await channel.assertQueue(auditQueue, { durable: true });
          await channel.bindQueue(auditQueue, exchange, "#");
        }
      },
    });
  }
  async publish(event: DomainEvent<unknown>) {
    await this.channel.publish(
      exchangeName(this.config),
      event.tipo,
      Buffer.from(JSON.stringify({ pattern: event.tipo, data: event })),
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventoId,
        correlationId: event.correlationId,
        timeout: 5000,
      },
    );
  }
  async onApplicationShutdown() {
    await this.channel.close();
    await this.connection.close();
  }
}

@Injectable()
export class SagaOutbox implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private readonly logger = new Logger(SagaOutbox.name);
  constructor(
    private readonly source: DataSource,
    private readonly bus: SagaBus,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      this.pending ??= this.flush()
        .catch(() => {
          this.logger.error("Outbox retry pending");
        })
        .finally(() => {
          this.pending = undefined;
        });
    }, 500);
    this.timer.unref();
  }
  async flush() {
    await this.source.transaction(async (manager) => {
      const rows = await manager.query<
        Array<{ event_id: string; payload: SagaEvent }>
      >(`SELECT event_id,payload FROM saga_outbox
        WHERE published_at IS NULL AND next_attempt <= now() ORDER BY created_at,event_id LIMIT 20 FOR UPDATE SKIP LOCKED`);
      for (const row of rows) {
        try {
          await this.bus.publish(row.payload);
          await manager.query(
            "UPDATE saga_outbox SET published_at=now() WHERE event_id=$1",
            [row.event_id],
          );
        } catch {
          await manager.query(
            "UPDATE saga_outbox SET attempts=attempts+1,next_attempt=now()+interval '5 seconds' WHERE event_id=$1",
            [row.event_id],
          );
        }
      }
    });
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.pending;
  }
}

export async function consumeSaga(
  context: RmqContext,
  payload: unknown,
  work: (event: SagaEvent) => Promise<void>,
) {
  const channel = context.getChannelRef() as ConfirmChannel;
  const message = context.getMessage() as ConsumeMessage;
  try {
    const event = validateSagaEvent(payload);
    if (String(context.getPattern()) !== event.tipo)
      throw new PermanentSagaError("Pattern/envelope mismatch");
    await work(event);
    channel.ack(message);
  } catch (error) {
    if (!(error instanceof PermanentSagaError))
      await new Promise((resolve) => setTimeout(resolve, 500));
    channel.nack(message, false, !(error instanceof PermanentSagaError));
  }
}

@Global()
@Module({})
export class SagaRuntimeModule {
  static forService(role: SagaServiceName): DynamicModule {
    return {
      module: SagaRuntimeModule,
      imports: [ConfigModule],
      providers: [
        { provide: SAGA_SERVICE, useValue: role },
        SagaStore,
        SagaBus,
        SagaOutbox,
      ],
      exports: [SagaStore, SagaBus, SagaOutbox],
    };
  }
}
