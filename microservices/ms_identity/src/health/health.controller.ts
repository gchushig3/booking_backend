import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/auth.decorators.js';
import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../openapi/endpoint.js';
import { HealthResponse } from '../openapi/responses.js';
@ApiTags('Salud')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly source: DataSource) {}
  @Get('live')
  @ApiEndpoint({
    summary: 'Comprobar proceso HTTP',
    access: 'public',
    type: HealthResponse,
  })
  live(): { status: 'UP' } {
    return { status: 'UP' };
  }
  @Get('ready')
  @ApiEndpoint({
    summary: 'Comprobar conexión PostgreSQL',
    access: 'public',
    type: HealthResponse,
    description:
      'Ejecuta SELECT 1; devuelve 503 si PostgreSQL no responde. No comprueba SMTP ni esquema.',
  })
  async ready(): Promise<{ status: 'UP' }> {
    try {
      await this.source.query('SELECT 1');
      return { status: 'UP' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
