import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadoService } from './estado.service.js';
import { EstadoController } from './estado.controller.js';
import { Estado } from './estado.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Estado])],
  controllers: [EstadoController],
  providers: [EstadoService],
})
export class EstadoModule {}
