import { Entity, PrimaryColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionEntity } from './atraccion.entity.js';
import { CategoriaEntity } from './categoria.entity.js';

@Entity({ name: 'atraccion_categoria', synchronize: false })
@Index('ix_atraccion_categoria_cat_id', ['cat_id'])
export class AtraccionCategoriaEntity {
  @PrimaryColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_atraccion_categoria',
  })
  atr_id!: string;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'pk_atraccion_categoria',
  })
  cat_id!: number;

  @ManyToOne(() => AtraccionEntity, (value) => value.categorias, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'atr_id',
    referencedColumnName: 'atr_id',
    foreignKeyConstraintName: 'fk_atraccion_categoria_atraccion',
  })
  atraccion!: Relation<AtraccionEntity>;

  @ManyToOne(() => CategoriaEntity, (value) => value.atracciones, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'cat_id',
    referencedColumnName: 'cat_id',
    foreignKeyConstraintName: 'fk_atraccion_categoria_categoria',
  })
  categoria!: Relation<CategoriaEntity>;
}
