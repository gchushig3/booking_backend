import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { HealthModule } from './health/health.module.js';
import { CuponModule } from './cupon/cupon.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    HealthModule,
    CuponModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
