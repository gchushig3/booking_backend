import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttractionLocation } from './attraction-location.entity.js';
import { AttractionLocationController } from './attraction-location.controller.js';
import { AttractionLocationService } from './attraction-location.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AttractionLocation])],
  controllers: [AttractionLocationController],
  providers: [AttractionLocationService],
})
export class AttractionLocationModule {}
