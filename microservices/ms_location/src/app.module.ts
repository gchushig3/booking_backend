import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  IdentityAccessGuard,
  NeonDatabaseModule,
} from '@booking/infrastructure';
import { HealthModule } from './health/health.module.js';
import { RegionModule } from './region/region.module.js';
import { ProvinciaModule } from './provincia/provincia.module.js';
import { CiudadModule } from './ciudad/ciudad.module.js';
import { AttractionLocationModule } from './attraction-location/attraction-location.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    HealthModule,
    RegionModule,
    ProvinciaModule,
    CiudadModule,
    AttractionLocationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: IdentityAccessGuard }],
})
export class AppModule {}
