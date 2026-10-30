import { Module, DynamicModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  TypeOrmModule,
  TypeOrmModuleOptions,
  TypeOrmModuleAsyncOptions,
} from "@nestjs/typeorm";
import { positiveInteger } from "./config.js";

export function neonOptions(config: ConfigService): TypeOrmModuleOptions {
  const url = new URL(config.getOrThrow<string>("DATABASE_URL"));
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Invalid DATABASE_URL");
  // pg reemplaza el objeto ssl si estos parametros estan presentes en la URL.
  for (const key of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "ssl",
    "uselibpqcompat",
  ]) {
    url.searchParams.delete(key);
  }
  return {
    type: "postgres",
    url: url.toString(),
    ssl: { rejectUnauthorized: false },
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    extra: {
      max: positiveInteger(config, "DB_POOL_MAX", 5),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
  };
}

@Module({})
export class NeonDatabaseModule {
  static forRootAsync(options: TypeOrmModuleAsyncOptions = {}): DynamicModule {
    const { useFactory, ...rest } = options;
    return {
      module: NeonDatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: neonOptions,
          ...rest,
          ...(useFactory ? { useFactory } : {}),
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}

/** Adaptar validadores heredados a DATABASE_URL sin habilitar DDL. */
export function databaseEnvironment(
  source: Record<string, unknown>,
): Record<string, unknown> {
  if (!source.DATABASE_URL) return source;
  const url = new URL(String(source.DATABASE_URL));
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Invalid DATABASE_URL");
  return {
    ...source,
    DB_HOST: url.hostname,
    DB_PORT: url.port || "5432",
    DB_USERNAME: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password),
    DB_DATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
}
