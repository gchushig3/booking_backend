import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Estado } from '../estado/estado.entity.js';
import { MetodoPago } from '../metodo_pago/metodo_pago.entity.js';

@Entity({ name: 'pago' })
@Check('pago_monto_valido', '"pag_monto" > 0')
@Check(
  'pago_aprobado_o_rechazado',
  '"pag_aprobado_en" IS NULL OR "pag_rechazado_en" IS NULL',
)
@Check(
  'pago_motivo_solo_si_rechazado',
  '"pag_motivo_rechazo" IS NULL OR "pag_rechazado_en" IS NOT NULL',
)
export class Pago {
  @PrimaryGeneratedColumn('identity', {
    name: 'pag_id',
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  pagId!: string;

  @Column({ name: 'pag_numero', type: 'varchar', length: 30, unique: true })
  pagNumero!: string;

  @Column({ name: 'ord_id', type: 'bigint' })
  ordId!: string;

  @Column({ name: 'mpa_id', type: 'smallint' })
  mpaId!: number;

  @Column({ name: 'est_id', type: 'smallint' })
  estId!: number;

  @ManyToOne(() => MetodoPago, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'mpa_id',
    referencedColumnName: 'mpaId',
    foreignKeyConstraintName: 'fk_pago_metodo_pago',
  })
  metodoPago!: MetodoPago;

  @ManyToOne(() => Estado, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({
    name: 'est_id',
    referencedColumnName: 'estId',
    foreignKeyConstraintName: 'fk_pago_estado',
  })
  estado!: Estado;

  @Column({ name: 'pag_monto', type: 'numeric', precision: 12, scale: 2 })
  pagMonto!: string;

  @Column({
    name: 'pag_referencia',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  pagReferencia!: string | null;

  @Column({
    name: 'pag_autorizacion',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  pagAutorizacion!: string | null;

  @Column({ name: 'pag_fecha', type: 'timestamptz', default: () => 'now()' })
  pagFecha!: Date;

  @Column({ name: 'pag_aprobado_en', type: 'timestamptz', nullable: true })
  pagAprobadoEn!: Date | null;

  @Column({ name: 'pag_rechazado_en', type: 'timestamptz', nullable: true })
  pagRechazadoEn!: Date | null;

  @Column({
    name: 'pag_motivo_rechazo',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  pagMotivoRechazo!: string | null;

  @Column({
    name: 'pag_creado_en',
    type: 'timestamptz',
    default: () => 'now()',
  })
  pagCreadoEn!: Date;
}
