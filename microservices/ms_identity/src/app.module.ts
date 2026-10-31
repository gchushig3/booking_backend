import { createIdentityDataSource } from './database/identity-domains.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NeonDatabaseModule, neonOptions } from '@booking/infrastructure';
import { IDENTITY_ENTITIES } from './database/entities/index.js';
import { validateEnvironment } from './config/environment.js';
import type { IdentityEnvironment } from './config/environment.js';
import { databaseOptions } from './database/database-options.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
@Module({
  imports: [
    AuthModule,
    UsersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (source: Record<string, unknown>) => ({
        ...source,
        identity: validateEnvironment(source),
      }),
    }),
    NeonDatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...(config.get<string>('DATABASE_URL')
          ? { ...neonOptions(config), entities: IDENTITY_ENTITIES }
          : databaseOptions(
              config.getOrThrow<IdentityEnvironment>('identity'),
            )),
        retryAttempts: 1,
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Missing PostgreSQL configuration');
        return createIdentityDataSource(options).initialize();
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
