import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Check,
  Index,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionInclusionEntity } from './atraccion-inclusion.entity.js';

@Entity({ name: 'inclusion', synchronize: false })
@Unique('uq_inclusion_tipo_nombre', ['inc_tipo', 'inc_nombre'])
@Check(
  'inclusion_tipo_valido',
  "inc_tipo IN ('INCLUYE', 'NO_INCLUYE', 'RECOMENDACION')",
)
@Index('ix_inclusion_inc_tipo', ['inc_tipo'])
export class InclusionEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'integer',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'inclusion_pkey',
  })
  inc_id!: number;

  @Column({ type: 'varchar', length: 20 })
  inc_tipo!: string;

  @Column({ type: 'varchar', length: 150 })
  inc_nombre!: string;

  @Column({ type: 'smallint', default: 0 })
  inc_orden!: number;

  @OneToMany(() => AtraccionInclusionEntity, (value) => value.inclusion, {
    cascade: false,
  })
  atracciones!: Relation<AtraccionInclusionEntity[]>;
}
