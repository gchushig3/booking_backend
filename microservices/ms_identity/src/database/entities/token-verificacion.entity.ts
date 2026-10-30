import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { UsuarioEntity } from './usuario.entity.js';
@Entity({ name: 'token_verificacion', synchronize: false })
@Unique('token_verificacion_tokv_token_key', ['tokv_token'])
@Check(
  'token_verificacion_tipo_valido',
  "tokv_tipo IN ('EMAIL', 'RECUPERACION')",
)
@Index('ix_token_verificacion_usu_id', ['usu_id'])
export class TokenVerificacionEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'token_verificacion_pkey',
  })
  tokv_id!: string;
  @Column({ type: 'bigint' })
  usu_id!: string;
  @Column({ type: 'varchar', length: 128, select: false })
  tokv_token!: string;
  @Column({ type: 'varchar', length: 20 })
  tokv_tipo!: string;
  @Column({ type: 'timestamptz' })
  tokv_expira_en!: Date;
  @Column({ type: 'boolean', default: false })
  tokv_usado!: boolean;
  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  tokv_creado_en!: Date;
  @ManyToOne(() => UsuarioEntity, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'usu_id',
    referencedColumnName: 'usu_id',
    foreignKeyConstraintName: 'fk_token_verificacion_usuario',
  })
  usuario!: Relation<UsuarioEntity>;
}
