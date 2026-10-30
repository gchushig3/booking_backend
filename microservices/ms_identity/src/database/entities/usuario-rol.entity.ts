import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { RolEntity } from './rol.entity.js';
import { UsuarioEntity } from './usuario.entity.js';
@Entity({ name: 'usuario_rol', synchronize: false })
@Index('ix_usuario_rol_rol_id', ['rol_id'])
@Index('ix_usuario_rol_asignado_por', ['usr_asignado_por'])
export class UsuarioRolEntity {
  @PrimaryColumn({ type: 'bigint', primaryKeyConstraintName: 'pk_usuario_rol' })
  usu_id!: string;
  @PrimaryColumn({
    type: 'smallint',
    primaryKeyConstraintName: 'pk_usuario_rol',
  })
  rol_id!: number;
  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  usr_asignado_en!: Date;
  @Column({ type: 'bigint', nullable: true })
  usr_asignado_por!: string | null;
  @ManyToOne(() => UsuarioEntity, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'usu_id',
    referencedColumnName: 'usu_id',
    foreignKeyConstraintName: 'fk_usuario_rol_usuario',
  })
  usuario!: Relation<UsuarioEntity>;
  @ManyToOne(() => RolEntity, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'rol_id',
    referencedColumnName: 'rol_id',
    foreignKeyConstraintName: 'fk_usuario_rol_rol',
  })
  rol!: Relation<RolEntity>;
  @ManyToOne(() => UsuarioEntity, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    cascade: false,
  })
  @JoinColumn({
    name: 'usr_asignado_por',
    referencedColumnName: 'usu_id',
    foreignKeyConstraintName: 'fk_usuario_rol_asignador',
  })
  asignador!: Relation<UsuarioEntity> | null;
}
