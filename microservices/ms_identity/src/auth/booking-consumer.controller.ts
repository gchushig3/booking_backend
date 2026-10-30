import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  BookingApiKeyGuard,
  JsonSchemaValidationPipe,
} from '@booking/infrastructure';
import { AuthService } from './auth.service.js';
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from './auth.decorators.js';

@ApiTags('Integracion Booking')
@Controller('auth/booking')
export class BookingConsumerController {
  constructor(private readonly auth: AuthService) {}

  @Get('verify-api-key')
  @Public()
  @UseGuards(BookingApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiSecurity('booking-api-key')
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['valid', 'consumer'],
      properties: {
        valid: { type: 'boolean', enum: [true] },
        consumer: { type: 'string', enum: ['booking'] },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'API Key invalida' })
  @ApiOperation({ summary: 'Verificar credenciales de consumidor Booking' })
  verify() {
    return { valid: true, consumer: 'booking' };
  }

  @Post('introspect')
  @HttpCode(200)
  @Public()
  @UseGuards(BookingApiKeyGuard)
  @ApiHeader({ name: 'X-API-Key', required: true })
  @ApiSecurity('booking-api-key')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['access_token'],
      additionalProperties: false,
      properties: {
        access_token: { type: 'string', minLength: 1, maxLength: 8192 },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['userId', 'sessionId', 'roles'],
      properties: {
        userId: { type: 'string' },
        sessionId: { type: 'string', format: 'uuid' },
        roles: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'API Key, JWT o sesion invalidos' })
  @ApiOperation({
    summary: 'Validar JWT, sesion vigente y roles del consumidor',
  })
  async introspect(
    @Body(
      new JsonSchemaValidationPipe({
        type: 'object',
        required: ['access_token'],
        additionalProperties: false,
        properties: {
          access_token: { type: 'string', minLength: 1, maxLength: 8192 },
        },
      }),
    )
    body: {
      access_token: string;
    },
  ) {
    return this.auth.authenticate(body.access_token);
  }
}
