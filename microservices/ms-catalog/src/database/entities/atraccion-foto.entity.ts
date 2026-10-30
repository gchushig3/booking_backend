import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionEntity } from './atraccion.entity.js';

@Entity({ name: 'atraccion_foto', synchronize: false })
@Index('ix_atraccion_foto_atr_id', ['atr_id'])
export class AtraccionFotoEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'atraccion_foto_pkey',
  })
  fot_id!: string;

  @Column({ type: 'bigint' })
  atr_id!: string;

  @Column({ type: 'varchar', length: 500 })
  fot_url!: string;

  @Column({ type: 'varchar', length: 200 })
  fot_alt!: string;

  @Column({ type: 'smallint', default: 0 })
  fot_orden!: number;

  @ManyToOne(() => AtraccionEntity, (value) => value.fotos, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'atr_id',
    referencedColumnName: 'atr_id',
    foreignKeyConstraintName: 'fk_atraccion_foto_atraccion',
  })
  atraccion!: Relation<AtraccionEntity>;
}
