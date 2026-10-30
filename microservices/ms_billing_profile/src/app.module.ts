import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { HealthModule } from './health/health.module.js';
import { DatoFacturacionModule } from './dato-facturacion/dato-facturacion.module.js';

// El esquema lo crea init-billing_profile.sql; TypeORM nunca ejecuta DDL.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    HealthModule,
    DatoFacturacionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
