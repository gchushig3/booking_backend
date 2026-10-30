import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  InfrastructureRoles,
  JsonSchemaValidationPipe,
} from '@booking/infrastructure';
import { RefundService } from './refund.service.js';
import { refundRequestSchema } from './refund.schemas.js';
import type { RefundRequest } from './refund.schemas.js';

@Controller('refunds')
export class RefundController {
  constructor(private readonly service: RefundService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  request(
    @Body(new JsonSchemaValidationPipe(refundRequestSchema))
    body: RefundRequest,
  ) {
    return this.service.request(body);
  }

  @Get()
  @InfrastructureRoles('ADMIN')
  list() {
    return this.service.list();
  }
}
