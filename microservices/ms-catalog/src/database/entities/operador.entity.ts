import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Index,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { catalogDomain } from '../catalog-domains.js';
import { OperadorUsuarioEntity } from './operador-usuario.entity.js';
import { AtraccionEntity } from './atraccion.entity.js';

@Entity({ name: 'operador', synchronize: false })
@Unique('operador_ope_codigo_key', ['ope_codigo'])
@Unique('operador_ope_ruc_key', ['ope_ruc'])
@Index('ix_operador_prov_id', ['prov_id'])
export class OperadorEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'operador_pkey',
  })
  ope_id!: string;

  @Column({ type: 'integer' })
  ope_codigo!: number;

  @Column({ type: 'varchar', length: 150 })
  ope_nombre!: string;

  @Column({ type: catalogDomain('dom_ruc'), nullable: true })
  ope_ruc!: string | null;

  @Column({ type: catalogDomain('dom_correo'), nullable: true })
  ope_correo!: string | null;

  @Column({ type: catalogDomain('dom_telefono'), nullable: true })
  ope_telefono!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ope_direccion!: string | null;

  @Column({ type: 'smallint' })
  prov_id!: number;

  @Column({ type: 'boolean', default: true })
  ope_activo!: boolean;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  ope_creado_en!: Date;

  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  ope_actualizado_en!: Date;

  @OneToMany(() => OperadorUsuarioEntity, (value) => value.operador, {
    cascade: false,
  })
  usuarios!: Relation<OperadorUsuarioEntity[]>;

  @OneToMany(() => AtraccionEntity, (value) => value.operador, {
    cascade: false,
  })
  atracciones!: Relation<AtraccionEntity[]>;
}
