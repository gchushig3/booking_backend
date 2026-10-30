import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  NeonDatabaseModule,
  SagaRuntimeModule,
  IdentityAccessGuard,
} from '@booking/infrastructure';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventorySagaService } from './inventory-saga.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NeonDatabaseModule.forRootAsync(),
    SagaRuntimeModule.forService('ms_inventory'),
  ],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventorySagaService,
    { provide: APP_GUARD, useClass: IdentityAccessGuard },
  ],
})
export class AppModule {}
