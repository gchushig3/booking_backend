import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InclusionEntity } from '../../database/entities/inclusion.entity.js';
import { AtraccionInclusionEntity } from '../../database/entities/atraccion-inclusion.entity.js';
import { InclusionsService } from './inclusions.service.js';
import { InclusionsController } from './inclusions.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InclusionEntity, AtraccionInclusionEntity]),
  ],
  controllers: [InclusionsController],
  providers: [InclusionsService],
  exports: [InclusionsService],
})
export class InclusionsModule {}
