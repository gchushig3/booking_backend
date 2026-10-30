import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import {
  InvalidReviewEventError,
  ReviewProjectionService,
} from './review-projection.service.js';

interface AmqpContext {
  getChannelRef(): {
    ack(message: unknown): void;
    nack(message: unknown, allUpTo: boolean, requeue: boolean): void;
  };
  getMessage(): unknown;
}

@Controller()
export class ReviewEventsController {
  private readonly logger = new Logger(ReviewEventsController.name);

  constructor(private readonly projection: ReviewProjectionService) {}

  @EventPattern('RESENA_PUBLICADA')
  async onReviewPublished(
    @Payload() event: unknown,
    @Ctx() rawContext: unknown,
  ): Promise<void> {
    const context = rawContext as AmqpContext;
    const channel = context.getChannelRef();
    const message = context.getMessage();
    try {
      await this.projection.apply(event);
      channel.ack(message);
    } catch (error) {
      if (error instanceof InvalidReviewEventError) {
        this.logger.warn(`RESENA_PUBLICADA descartado: ${error.message}`);
        channel.nack(message, false, false);
        return;
      }
      this.logger.error('RESENA_PUBLICADA reintentara');
      channel.nack(message, false, true);
    }
  }
}
