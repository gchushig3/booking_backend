import { Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, RmqOptions, Transport } from "@nestjs/microservices";
import {
  connect,
  ChannelWrapper,
  AmqpConnectionManager,
} from "amqp-connection-manager";
import type { ConfirmChannel } from "amqplib";
import { positiveInteger } from "./config.js";

export const RMQ_CLIENT = "RMQ_CLIENT";

function amqpUrl(config: ConfigService): string {
  const url = config.getOrThrow<string>("AMQP_URL");
  if (new URL(url).protocol !== "amqps:")
    throw new Error("AMQP_URL must use amqps://");
  return url;
}

export function rabbitMqOptions(
  config: ConfigService,
  queue?: string,
): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [amqpUrl(config)],
      queue: queue ?? config.getOrThrow<string>("AMQP_QUEUE"),
      queueOptions: { durable: true },
      persistent: true,
      noAck: false,
      prefetchCount: positiveInteger(config, "AMQP_PREFETCH", 10),
    },
  };
}

export interface DomainEvent<T = unknown> {
  eventoId: string;
  tipo: string;
  fechaISO: string;
  origen: string;
  correlationId: string;
  data: T;
}

// Canal confirm con reconexion; envio directo a una cola durable de un consumidor.
@Injectable()
export class ConfirmedEventPublisher implements OnApplicationShutdown {
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly config: ConfigService) {}

  async publish<T>(queue: string, event: DomainEvent<T>): Promise<void> {
    await this.publishToQueue(queue, event);
    const auditQueue = this.config.get<string>("AMQP_AUDIT_QUEUE");
    if (auditQueue && auditQueue !== queue)
      await this.publishToQueue(auditQueue, event);
  }

  private async publishToQueue<T>(
    queue: string,
    event: DomainEvent<T>,
  ): Promise<void> {
    if (!this.channel) {
      this.connection = connect([amqpUrl(this.config)]);
      this.channel = this.connection.createChannel({ confirm: true });
    }
    if (!this.queues.has(queue)) {
      this.queues.set(
        queue,
        this.channel
          .addSetup(async (channel: ConfirmChannel) => {
            await channel.assertQueue(queue, { durable: true });
          })
          .catch((error: unknown) => {
            this.queues.delete(queue);
            throw error;
          }),
      );
    }
    await this.queues.get(queue);
    // Envelope compatible con @EventPattern(event.tipo) de NestJS.
    await this.channel.sendToQueue(
      queue,
      Buffer.from(
        JSON.stringify({
          pattern: event.tipo,
          data: event,
        }),
      ),
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventoId,
        correlationId: event.correlationId,
        timeout: 10000,
      },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: RMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: rabbitMqOptions,
      },
    ]),
  ],
  providers: [ConfirmedEventPublisher],
  exports: [ClientsModule, ConfirmedEventPublisher],
})
export class RabbitMqModule {}
