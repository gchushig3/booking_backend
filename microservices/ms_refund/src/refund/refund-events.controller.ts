import { BadRequestException, Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JsonSchemaValidationPipe } from '@booking/infrastructure';
import {
  InvalidRefundEventError,
  refundEventSchema,
  type RefundConfirmation,
} from './refund.schemas.js';
import { RefundService } from './refund.service.js';

interface RefundRmqContext {
  getChannelRef(): {
    ack(message: unknown): void;
    nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
  };
  getMessage(): unknown;
}

@Controller()
export class RefundEventsController {
  private readonly logger = new Logger(RefundEventsController.name);

  constructor(private readonly service: RefundService) {}

  @EventPattern('pago.reembolsado')
  async onRefunded(
    @Payload() rawEvent: unknown,
    @Ctx() rawContext: unknown,
  ): Promise<void> {
    const context = rawContext as RefundRmqContext;
    const channel = context.getChannelRef();
    const message = context.getMessage();
    try {
      const event = new JsonSchemaValidationPipe<RefundConfirmation>(
        refundEventSchema,
      ).transform(rawEvent);
      await this.service.confirm(event);
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `No se pudo procesar pago.reembolsado: ${String(error)}`,
      );
      if (
        error instanceof InvalidRefundEventError ||
        error instanceof BadRequestException
      ) {
        channel.nack(message, false, false);
      } else {
        channel.nack(message, false, true);
      }
    }
  }
}
