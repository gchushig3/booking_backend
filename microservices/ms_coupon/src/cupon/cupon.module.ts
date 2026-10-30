import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cupon } from './cupon.entity.js';
import { CuponesController } from './cupon.controller.js';
import { CuponService } from './cupon.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cupon])],
  controllers: [CuponesController],
  providers: [CuponService],
  exports: [TypeOrmModule],
})
export class CuponModule {}
