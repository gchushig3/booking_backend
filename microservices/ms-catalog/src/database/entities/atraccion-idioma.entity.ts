import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionEntity } from './atraccion.entity.js';
import { IdiomaEntity } from './idioma.entity.js';

@Entity({ name: 'atraccion_idioma', synchronize: false })
@Index('ix_atraccion_idioma_idi_id', ['idi_id'])
export class AtraccionIdiomaEntity {
  @PrimaryColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_atraccion_idioma',
  })
  atr_id!: string;

  @PrimaryColumn({
    type: 'smallint',
    primaryKeyConstraintName: 'pk_atraccion_idioma',
  })
  idi_id!: number;

  @ManyToOne(() => AtraccionEntity, (value) => value.idiomas, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'atr_id',
    referencedColumnName: 'atr_id',
    foreignKeyConstraintName: 'fk_atraccion_idioma_atraccion',
  })
  atraccion!: Relation<AtraccionEntity>;

  @ManyToOne(() => IdiomaEntity, (value) => value.atracciones, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'idi_id',
    referencedColumnName: 'idi_id',
    foreignKeyConstraintName: 'fk_atraccion_idioma_idioma',
  })
  idioma!: Relation<IdiomaEntity>;
}
