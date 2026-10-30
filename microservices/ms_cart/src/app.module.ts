import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  NeonDatabaseModule,
  SagaRuntimeModule,
  IdentityAccessGuard,
} from '@booking/infrastructure';
import { CartController } from './cart/cart.controller.js';
import { CartService } from './cart/cart.service.js';
import { InventoryClient } from './cart/inventory.client.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    SagaRuntimeModule.forService('ms_cart'),
  ],
  controllers: [AppController, CartController],
  providers: [
    AppService,
    CartService,
    InventoryClient,
    { provide: APP_GUARD, useClass: IdentityAccessGuard },
  ],
})
export class AppModule {}
