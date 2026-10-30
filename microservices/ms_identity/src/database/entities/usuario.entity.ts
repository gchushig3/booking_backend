import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { identityDomain } from '../identity-domains.js';
@Entity({ name: 'usuario', synchronize: false })
@Unique('usuario_usu_correo_key', ['usu_correo'])
@Unique('usuario_usu_documento_key', ['usu_documento'])
@Check(
  'usuario_nombres_no_vacios',
  "btrim(usu_nombre) <> '' AND btrim(usu_apellido) <> ''",
)
export class UsuarioEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'usuario_pkey',
  })
  usu_id!: string;
  @Column({ type: identityDomain('dom_correo') })
  usu_correo!: string;
  @Column({ type: 'varchar', length: 100, select: false })
  usu_password!: string;
  @Column({ type: 'varchar', length: 120 })
  usu_nombre!: string;
  @Column({ type: 'varchar', length: 120 })
  usu_apellido!: string;
  @Column({ type: identityDomain('dom_documento'), nullable: true })
  usu_documento!: string | null;
  @Column({ type: identityDomain('dom_telefono'), nullable: true })
  usu_telefono!: string | null;
  @Column({ type: 'date', nullable: true })
  usu_fecha_nacimiento!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  usu_avatar!: string | null;
  @Column({ type: 'boolean', default: false })
  usu_verificado!: boolean;
  @Column({ type: 'boolean', default: true })
  usu_activo!: boolean;
  @Column({ type: 'timestamptz', nullable: true })
  usu_ultimo_acceso!: Date | null;
  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  usu_creado_en!: Date;
  @Column({
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  usu_actualizado_en!: Date;
}
