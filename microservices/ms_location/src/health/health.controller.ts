import { Controller, Get } from '@nestjs/common';
import { PublicInfrastructure } from '@booking/infrastructure';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @PublicInfrastructure()
  @HealthCheck()
  async check() {
    return this.health.check([]);
  }
}
