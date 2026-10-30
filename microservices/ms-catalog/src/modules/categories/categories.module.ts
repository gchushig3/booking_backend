import { Module } from '@nestjs/common';
import { BookingModule } from '../../booking/booking.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriaEntity } from '../../database/entities/categoria.entity.js';
import { AtraccionCategoriaEntity } from '../../database/entities/atraccion-categoria.entity.js';
import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';

@Module({
  imports: [
    BookingModule,
    TypeOrmModule.forFeature([CategoriaEntity, AtraccionCategoriaEntity]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
