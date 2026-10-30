import { PublicEndpoint } from '../common/public-endpoint.decorator.js';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @PublicEndpoint()
  @Get('live')
  @ApiOperation({
    summary: 'Comprobar que el proceso HTTP está vivo',
    description: 'No comprueba PostgreSQL ni servicios externos.',
  })
  @ApiOkResponse({
    description: 'Proceso activo.',
    schema: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['UP'], example: 'UP' } },
    },
  })
  live(): { status: 'UP' } {
    return { status: 'UP' };
  }
}
