import { Controller, Get } from '@nestjs/common';
import { PublicInfrastructure } from '@booking/infrastructure';

@Controller('health')
export class HealthController {
  @Get()
  @PublicInfrastructure()
  check() {
    return { status: 'ok' };
  }
}
