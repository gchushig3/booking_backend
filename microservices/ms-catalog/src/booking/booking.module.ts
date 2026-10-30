import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMqModule, JsonSchemaModule } from '@booking/infrastructure';
import { AtraccionEntity } from '../database/entities/atraccion.entity.js';
import { CategoriaEntity } from '../database/entities/categoria.entity.js';
import { BookingProfileEntity } from './booking-profile.entity.js';
import { BookingCatalogService } from './booking-catalog.service.js';
import { CatalogEventsService } from './catalog-events.service.js';
import { ReviewEventsController } from './review-events.controller.js';
import { ReviewProjectionService } from './review-projection.service.js';
import { InventoryAvailabilityService } from './inventory-availability.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtraccionEntity,
      CategoriaEntity,
      BookingProfileEntity,
    ]),
    RabbitMqModule,
    JsonSchemaModule,
  ],
  controllers: [ReviewEventsController],
  providers: [
    BookingCatalogService,
    ReviewProjectionService,
    CatalogEventsService,
    InventoryAvailabilityService,
  ],
  exports: [BookingCatalogService, CatalogEventsService],
})
export class BookingModule {}
