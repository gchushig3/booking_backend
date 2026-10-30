import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Check,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionCategoriaEntity } from './atraccion-categoria.entity.js';

@Entity({ name: 'categoria', synchronize: false })
@Unique('categoria_cat_slug_key', ['cat_slug'])
@Check('categoria_no_es_ella_misma', 'cat_padre_id IS DISTINCT FROM cat_id')
@Index('ix_categoria_cat_padre_id', ['cat_padre_id'])
export class CategoriaEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'integer',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'categoria_pkey',
  })
  cat_id!: number;

  @Column({ type: 'integer', nullable: true })
  cat_padre_id!: number | null;

  @Column({ type: 'varchar', length: 80 })
  cat_nombre!: string;

  @Column({ type: 'varchar', length: 80 })
  cat_slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cat_descripcion!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'map-pin' })
  cat_icono!: string;

  @Column({ type: 'smallint', default: 0 })
  cat_orden!: number;

  @Column({ type: 'boolean', default: true })
  cat_activa!: boolean;

  @ManyToOne(() => CategoriaEntity, (value) => value.hijas, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'cat_padre_id',
    referencedColumnName: 'cat_id',
    foreignKeyConstraintName: 'fk_categoria_padre',
  })
  padre!: Relation<CategoriaEntity> | null;

  @OneToMany(() => CategoriaEntity, (value) => value.padre, { cascade: false })
  hijas!: Relation<CategoriaEntity[]>;

  @OneToMany(() => AtraccionCategoriaEntity, (value) => value.categoria, {
    cascade: false,
  })
  atracciones!: Relation<AtraccionCategoriaEntity[]>;
}
