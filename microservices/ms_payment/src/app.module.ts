import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import {
  NeonDatabaseModule,
  neonOptions,
  SagaRuntimeModule,
  IdentityAccessGuard,
} from '@booking/infrastructure';
import { PaymentSagaController } from './saga/payment-saga.controller.js';
import { PaymentSagaService } from './saga/payment-saga.service.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { MetodoPagoModule } from './metodo_pago/metodo_pago.module.js';
import { EstadoModule } from './estado/estado.module.js';
import { PagoModule } from './pago/pago.module.js';
import { PagoTarjetaModule } from './pago_tarjeta/pago_tarjeta.module.js';
import { PagoTransferenciaModule } from './pago_transferencia/pago_transferencia.module.js';
import { Estado } from './estado/estado.entity.js';
import { MetodoPago } from './metodo_pago/metodo_pago.entity.js';
import { Pago } from './pago/pago.entity.js';
import { PagoTarjeta } from './pago_tarjeta/pago_tarjeta.entity.js';
import { PagoTransferencia } from './pago_transferencia/pago_transferencia.entity.js';
import { validateEnvironment } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    NeonDatabaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.get('DATABASE_URL'))
          return {
            ...neonOptions(configService),
            entities: [
              MetodoPago,
              Estado,
              Pago,
              PagoTarjeta,
              PagoTransferencia,
            ],
          };
        return {
          type: 'postgres' as const,
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.getOrThrow<number>('DB_PORT'),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_DATABASE'),
          entities: [MetodoPago, Estado, Pago, PagoTarjeta, PagoTransferencia],
          synchronize: false,
          dropSchema: false,
          migrationsRun: false,
          logging: false,
        };
      },
    }),
    MetodoPagoModule,
    EstadoModule,
    PagoModule,
    PagoTarjetaModule,
    PagoTransferenciaModule,
    SagaRuntimeModule.forService('ms_payment'),
  ],
  controllers: [AppController, PaymentSagaController],
  providers: [
    AppService,
    PaymentSagaService,
    { provide: APP_GUARD, useClass: IdentityAccessGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
