import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ciudad } from './ciudad.entity.js';
import { CiudadesController } from './ciudad.controller.js';
import { CiudadService } from './ciudad.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ciudad])],
  controllers: [CiudadesController],
  providers: [CiudadService],
  exports: [TypeOrmModule],
})
export class CiudadModule {}
