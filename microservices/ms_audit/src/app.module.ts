import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { AuditModule } from './audit/audit.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    AuditModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
