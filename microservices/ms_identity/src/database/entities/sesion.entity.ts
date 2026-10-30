import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { UsuarioEntity } from './usuario.entity.js';
@Entity({ name: 'sesion', synchronize: false })
@Unique('sesion_ses_token_hash_key', ['ses_token_hash'])
@Index('ix_sesion_usu_id', ['usu_id'])
@Index('ix_sesion_expira_en', ['ses_expira_en'])
export class SesionEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
    primaryKeyConstraintName: 'sesion_pkey',
  })
  ses_id!: string;
  @Column({ type: 'bigint' })
  usu_id!: string;
  @Column({ type: 'varchar', length: 128, select: false })
  ses_token_hash!: string;
  @Column({ type: 'varchar', length: 45, nullable: true })
  ses_ip!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  ses_user_agent!: string | null;
  @Column({ type: 'timestamptz' })
  ses_expira_en!: Date;
  @Column({ type: 'boolean', default: false })
  ses_revocada!: boolean;
  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  ses_creado_en!: Date;
  @ManyToOne(() => UsuarioEntity, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'usu_id',
    referencedColumnName: 'usu_id',
    foreignKeyConstraintName: 'fk_sesion_usuario',
  })
  usuario!: Relation<UsuarioEntity>;
}
