import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperadorEntity } from '../../database/entities/operador.entity.js';
import { OperadorUsuarioEntity } from '../../database/entities/operador-usuario.entity.js';
import { AtraccionEntity } from '../../database/entities/atraccion.entity.js';
import { OperatorsService } from './operators.service.js';
import { OperatorsController } from './operators.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OperadorEntity,
      OperadorUsuarioEntity,
      AtraccionEntity,
    ]),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
