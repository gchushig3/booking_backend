import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  HttpCode,
} from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  consumeSaga,
  JsonSchemaValidationPipe,
  sagaBindings,
} from '@booking/infrastructure';
import type { SagaHttpRequest } from '@booking/infrastructure';
import { CartService, idempotencyKey } from './cart.service.js';
import { addCartItemSchema, checkoutSchema } from './cart.schemas.js';
import type { AddCartItem } from './cart.schemas.js';

@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}
  @Post('items')
  add(
    @Req() request: SagaHttpRequest,
    @Headers('idempotency-key') key: string,
    @Body(new JsonSchemaValidationPipe(addCartItemSchema)) body: AddCartItem,
  ) {
    return this.service.add(
      request.principal.userId,
      idempotencyKey(key),
      body,
    );
  }
  @Post('checkout')
  @HttpCode(202)
  checkout(
    @Req() request: SagaHttpRequest,
    @Headers('idempotency-key') key: string,
    @Body(new JsonSchemaValidationPipe(checkoutSchema))
    body: { testMode?: 'test_success' | 'test_fail' },
  ) {
    return this.service.checkout(
      request.principal.userId,
      idempotencyKey(key),
      body,
    );
  }
  @Delete()
  clear(@Req() request: SagaHttpRequest) {
    return this.service.clear(request.principal.userId);
  }
  @Get('reservations')
  list(@Req() request: SagaHttpRequest) {
    return this.service.list(request.principal.userId);
  }
  @Post('reservations/:id/cancel')
  @HttpCode(202)
  cancel(
    @Req() request: SagaHttpRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.cancel(
      request.principal.userId,
      id,
      request.headers.authorization ?? '',
    );
  }
  @Get('reservations/:id')
  get(
    @Req() request: SagaHttpRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.reservation(request.principal.userId, id);
  }
  @EventPattern([...sagaBindings.ms_cart])
  onEvent(@Payload() payload: unknown, @Ctx() context: RmqContext) {
    return consumeSaga(context, payload, (event) => this.service.event(event));
  }
}
