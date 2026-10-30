import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OperadorEntity } from './operador.entity.js';

@Entity({ name: 'operador_usuario', synchronize: false })
@Index('ix_operador_usuario_usu_id', ['usu_id'])
export class OperadorUsuarioEntity {
  @PrimaryColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_operador_usuario',
  })
  ope_id!: string;

  @PrimaryColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_operador_usuario',
  })
  usu_id!: string;

  @Column({ type: 'varchar', length: 60 })
  opeu_cargo!: string;

  @Column({ type: 'boolean', default: true })
  opeu_activo!: boolean;

  @ManyToOne(() => OperadorEntity, (value) => value.usuarios, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'ope_id',
    referencedColumnName: 'ope_id',
    foreignKeyConstraintName: 'fk_operador_usuario_operador',
  })
  operador!: Relation<OperadorEntity>;
}
