import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { connect } from 'amqp-connection-manager';
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { AuditService } from './audit.service.js';
import { InvalidAuditEventError, type AuditEnvelope } from './audit.schemas.js';

@Injectable()
export class AuditConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumer.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('AMQP_URL');
    if (new URL(url).protocol !== 'amqps:') {
      throw new Error('AMQP_URL debe usar amqps://');
    }
    const queues = (this.config.get<string>('AMQP_AUDIT_QUEUES') ?? '')
      .split(',')
      .map((queue) => queue.trim())
      .filter(Boolean);
    if (!queues.length) {
      throw new Error(
        'AMQP_AUDIT_QUEUES debe incluir al menos una cola mirror',
      );
    }

    this.connection = connect([url]);
    this.channel = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        await channel.prefetch(Number(this.config.get('AMQP_PREFETCH') ?? 20));
        for (const queue of queues) {
          await channel.assertQueue(queue, { durable: true });
          await channel.consume(
            queue,
            (message) => {
              if (message) void this.consume(channel, queue, message);
            },
            { noAck: false },
          );
        }
      },
    });
    await this.channel.waitForConnect();
    this.logger.log(`Consumidor de auditoria activo en ${queues.join(', ')}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async consume(
    channel: ConfirmChannel,
    queue: string,
    message: ConsumeMessage,
  ): Promise<void> {
    let envelope: AuditEnvelope;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(message.content.toString('utf8')) as Record<
        string,
        unknown
      >;
      envelope = raw as AuditEnvelope;
      const eventId =
        typeof envelope.eventoId === 'string'
          ? envelope.eventoId
          : message.properties.messageId ||
            createHash('sha256').update(message.content).digest('hex');
      await this.audit.recordEnvelope(envelope, queue, eventId, raw);
      channel.ack(message);
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        error instanceof TypeError ||
        error instanceof InvalidAuditEventError
      ) {
        this.logger.warn(`Mensaje invalido descartado de ${queue}`);
        channel.ack(message);
        return;
      }
      this.logger.error(
        `Fallo guardando evento desde ${queue}: ${String(error)}`,
      );
      channel.nack(message, false, true);
    }
  }
}
