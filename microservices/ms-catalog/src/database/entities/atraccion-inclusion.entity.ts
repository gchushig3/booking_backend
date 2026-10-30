import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionEntity } from './atraccion.entity.js';
import { InclusionEntity } from './inclusion.entity.js';

@Entity({ name: 'atraccion_inclusion', synchronize: false })
@Index('ix_atraccion_inclusion_inc_id', ['inc_id'])
export class AtraccionInclusionEntity {
  @PrimaryColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_atraccion_inclusion',
  })
  atr_id!: string;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'pk_atraccion_inclusion',
  })
  inc_id!: number;

  @ManyToOne(() => AtraccionEntity, (value) => value.inclusiones, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'atr_id',
    referencedColumnName: 'atr_id',
    foreignKeyConstraintName: 'fk_atraccion_inclusion_atraccion',
  })
  atraccion!: Relation<AtraccionEntity>;

  @ManyToOne(() => InclusionEntity, (value) => value.atracciones, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'inc_id',
    referencedColumnName: 'inc_id',
    foreignKeyConstraintName: 'fk_atraccion_inclusion_inclusion',
  })
  inclusion!: Relation<InclusionEntity>;
}
