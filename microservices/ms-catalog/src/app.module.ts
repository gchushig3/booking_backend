import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NeonDatabaseModule, neonOptions } from '@booking/infrastructure';
import { CATALOG_ENTITIES } from './database/entities/index.js';
import { validateEnvironment } from './config/environment.js';
import type { Environment } from './config/environment.js';
import { databaseOptions } from './database/database-options.js';
import { createCatalogDataSource } from './database/catalog-domains.js';
import { HealthModule } from './health/health.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { LanguagesModule } from './modules/languages/languages.module.js';
import { InclusionsModule } from './modules/inclusions/inclusions.module.js';
import { OperatorsModule } from './modules/operators/operators.module.js';
import { AttractionsModule } from './modules/attractions/attractions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (source: Record<string, unknown>) => ({
        ...source,
        catalog: validateEnvironment(source),
      }),
    }),
    NeonDatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...(config.get<string>('DATABASE_URL')
          ? { ...neonOptions(config), entities: CATALOG_ENTITIES }
          : databaseOptions(config.getOrThrow<Environment>('catalog'))),
        retryAttempts: 1,
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Falta configuración de PostgreSQL');
        return createCatalogDataSource(options).initialize();
      },
    }),
    HealthModule,
    CategoriesModule,
    LanguagesModule,
    InclusionsModule,
    OperatorsModule,
    AttractionsModule,
  ],
})
export class AppModule {}
