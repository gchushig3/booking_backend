import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { HealthController } from './health.controller.js';
import { ResenaModule } from './resena/resena.module.js';

// El esquema lo crea init-review.sql; TypeORM nunca ejecuta DDL.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    ResenaModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
