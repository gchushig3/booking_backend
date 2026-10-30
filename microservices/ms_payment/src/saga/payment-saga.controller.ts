import {
  BadRequestException,
  Logger,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  HttpCode,
} from '@nestjs/common';
import { EventPattern, Ctx, Payload, RmqContext } from '@nestjs/microservices';
import {
  consumeSaga,
  JsonSchemaValidationPipe,
  PermanentSagaError,
  sagaBindings,
  InfrastructureRoles,
} from '@booking/infrastructure';
import type { SagaHttpRequest, ReservationData } from '@booking/infrastructure';
import { PaymentSagaService } from './payment-saga.service.js';

@Controller('saga/payments')
export class PaymentSagaController {
  private readonly logger = new Logger(PaymentSagaController.name);

  constructor(private readonly service: PaymentSagaService) {}
  @Get(':id')
  get(
    @Req() request: SagaHttpRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(
      request.principal.userId,
      id,
      request.principal.roles,
    );
  }
  // Diagnostico sin crear cobros ni eventos; pruebas deterministas reales se solicitan en checkout.
  @Post('preview')
  @HttpCode(200)
  @InfrastructureRoles('ADMIN')
  preview(
    @Body(
      new JsonSchemaValidationPipe({
        type: 'object',
        additionalProperties: false,
        properties: { testMode: { enum: ['test_success', 'test_fail'] } },
      }),
    )
    body: {
      testMode?: ReservationData['testMode'];
    },
  ) {
    return this.service.preview(body);
  }
  @EventPattern([...sagaBindings.ms_payment])
  onEvent(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    if (
      (payload as { tipo?: unknown } | null)?.tipo === 'reembolso.solicitado'
    ) {
      return this.onRefundRequested(payload, context);
    }
    return consumeSaga(context, payload, (event) => this.service.event(event));
  }

  private async onRefundRequested(
    payload: unknown,
    context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const message = context.getMessage();
    try {
      const event = new JsonSchemaValidationPipe<RefundRequestedEvent>(
        refundRequestedEventSchema,
      ).transform(payload);
      await this.service.refundRequested(event);
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `No se pudo procesar reembolso solicitado: ${String(error)}`,
      );
      channel.nack(
        message,
        false,
        !(
          error instanceof BadRequestException ||
          error instanceof PermanentSagaError
        ),
      );
    }
  }
}

interface RefundRequestedEvent {
  eventoId: string;
  tipo: 'reembolso.solicitado';
  fechaISO: string;
  origen: 'ms_refund';
  correlationId: string;
  data: {
    pag_id: string;
    rem_id: string;
    rem_numero: string;
    rem_monto: number;
    rem_motivo?: string | null;
  };
}

const refundRequestedEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eventoId', 'tipo', 'fechaISO', 'origen', 'correlationId', 'data'],
  properties: {
    eventoId: { type: 'string', minLength: 1, maxLength: 128 },
    tipo: { const: 'reembolso.solicitado' },
    fechaISO: { type: 'string', format: 'date-time' },
    origen: { const: 'ms_refund' },
    correlationId: { type: 'string', format: 'uuid' },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['pag_id', 'rem_id', 'rem_numero', 'rem_monto'],
      properties: {
        pag_id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
        rem_id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
        rem_numero: { type: 'string', minLength: 1, maxLength: 30 },
        rem_monto: {
          type: 'number',
          exclusiveMinimum: 0,
          multipleOf: 0.01,
        },
        rem_motivo: { type: ['string', 'null'], maxLength: 300 },
      },
    },
  },
};
