import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provincia } from './provincia.entity.js';
import { ProvinciasController } from './provincia.controller.js';
import { ProvinciaService } from './provincia.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Provincia])],
  controllers: [ProvinciasController],
  providers: [ProvinciaService],
  exports: [TypeOrmModule],
})
export class ProvinciaModule {}
