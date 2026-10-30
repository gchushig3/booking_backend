import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditConsumer } from './audit-consumer.service.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer],
})
export class AuditModule {}
