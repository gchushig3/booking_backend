import { Controller, Get, Query } from '@nestjs/common';
import {
  InfrastructureRoles,
  JsonSchemaValidationPipe,
} from '@booking/infrastructure';
import { AuditService } from './audit.service.js';
import { auditFilterSchema } from './audit.schemas.js';

@Controller('audit/events')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @InfrastructureRoles('ADMIN')
  list(
    @Query(new JsonSchemaValidationPipe(auditFilterSchema))
    filters: {
      correlationId?: string;
      eventType?: string;
      limit?: string;
    },
  ) {
    return this.service.list(filters);
  }
}
