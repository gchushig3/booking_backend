import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  DeleteDateColumn,
  Check,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { catalogDomain } from '../catalog-domains.js';
import { OperadorEntity } from './operador.entity.js';
import { AtraccionCategoriaEntity } from './atraccion-categoria.entity.js';
import { AtraccionIdiomaEntity } from './atraccion-idioma.entity.js';
import { AtraccionInclusionEntity } from './atraccion-inclusion.entity.js';
import { AtraccionFotoEntity } from './atraccion-foto.entity.js';

@Entity({ name: 'atraccion', synchronize: false })
@Unique('atraccion_atr_slug_key', ['atr_slug'])
@Unique('uq_atraccion_uuid', ['atr_uuid'])
@Check(
  'atraccion_duracion_valida',
  'atr_duracion_horas > 0 AND atr_duracion_horas <= 720',
)
@Check(
  'atraccion_calificacion_valida',
  'atr_calificacion_promedio >= 0 AND atr_calificacion_promedio <= 5',
)
@Check('atraccion_latitud_valida', 'atr_latitud BETWEEN -90 AND 90')
@Check('atraccion_longitud_valida', 'atr_longitud BETWEEN -180 AND 180')
@Check('atraccion_horas_cancelacion_valida', 'atr_horas_cancelacion >= 0')
@Check(
  'atraccion_tipo_valido',
  "atr_tipo IN ('GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE')",
)
@Check(
  'atraccion_estado_valido',
  "atr_estado IN ('BORRADOR', 'PUBLICADA', 'INACTIVA')",
)
@Index('ix_atraccion_ciu_id', ['ciu_id'])
@Index('ix_atraccion_ope_id', ['ope_id'])
@Index('ix_atraccion_estado', ['atr_estado'])
@Index('ix_atraccion_busqueda', { synchronize: false })
export class AtraccionEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'atraccion_pkey',
  })
  atr_id!: string;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  atr_uuid!: string;

  @Column({ type: 'varchar', length: 200 })
  atr_nombre!: string;

  @Column({ type: 'varchar', length: 220 })
  atr_slug!: string;

  @Column({ type: 'text' })
  atr_descripcion!: string;

  @Column({ type: 'varchar', length: 280, nullable: true })
  atr_descripcion_corta!: string | null;

  @Column({ type: 'varchar', length: 30 })
  atr_tipo!: string;

  @Column({ type: 'varchar', length: 20, default: 'BORRADOR' })
  atr_estado!: string;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  atr_latitud!: string;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  atr_longitud!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  atr_direccion!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  atr_punto_encuentro!: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  atr_duracion_horas!: string;

  @Column({ type: catalogDomain('dom_moneda'), default: 'USD' })
  atr_moneda!: string;

  @Column({ type: 'smallint' })
  ciu_id!: number;

  @Column({ type: 'bigint' })
  ope_id!: string;

  @Column({ type: 'boolean', default: false })
  atr_cancelacion_gratuita!: boolean;

  @Column({ type: 'smallint', default: 24 })
  atr_horas_cancelacion!: number;

  @Column({ type: 'boolean', default: false })
  atr_destacada!: boolean;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
    insert: false,
    update: false,
  })
  atr_calificacion_promedio!: string;

  @Column({ type: 'integer', default: 0, insert: false, update: false })
  atr_numero_resenas!: number;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  atr_creado_en!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  atr_actualizado_en!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  atr_eliminado_en!: Date | null;

  @ManyToOne(() => OperadorEntity, (value) => value.atracciones, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'ope_id',
    referencedColumnName: 'ope_id',
    foreignKeyConstraintName: 'fk_atraccion_operador',
  })
  operador!: Relation<OperadorEntity>;

  @OneToMany(() => AtraccionCategoriaEntity, (value) => value.atraccion, {
    cascade: false,
  })
  categorias!: Relation<AtraccionCategoriaEntity[]>;

  @OneToMany(() => AtraccionIdiomaEntity, (value) => value.atraccion, {
    cascade: false,
  })
  idiomas!: Relation<AtraccionIdiomaEntity[]>;

  @OneToMany(() => AtraccionInclusionEntity, (value) => value.atraccion, {
    cascade: false,
  })
  inclusiones!: Relation<AtraccionInclusionEntity[]>;

  @OneToMany(() => AtraccionFotoEntity, (value) => value.atraccion, {
    cascade: false,
  })
  fotos!: Relation<AtraccionFotoEntity[]>;
}
