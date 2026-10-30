import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PublicInfrastructure } from '@booking/infrastructure';

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
