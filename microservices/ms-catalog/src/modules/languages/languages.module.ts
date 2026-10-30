import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdiomaEntity } from '../../database/entities/idioma.entity.js';
import { AtraccionIdiomaEntity } from '../../database/entities/atraccion-idioma.entity.js';
import { LanguagesService } from './languages.service.js';
import { LanguagesController } from './languages.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([IdiomaEntity, AtraccionIdiomaEntity])],
  controllers: [LanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
