import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { HealthModule } from './health/health.module.js';
import { RefundModule } from './refund/refund.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    HealthModule,
    RefundModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
