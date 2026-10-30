import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Region } from './region.entity.js';
import { RegionsController } from './region.controller.js';
import { RegionService } from './region.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Region])],
  controllers: [RegionsController],
  providers: [RegionService],
  exports: [TypeOrmModule],
})
export class RegionModule {}
