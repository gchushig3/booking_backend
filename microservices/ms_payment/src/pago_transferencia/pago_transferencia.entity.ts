import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Pago } from '../pago/pago.entity.js';

@Entity({ name: 'pago_transferencia' })
@Unique('uq_pago_transferencia_pag_id', ['pagId'])
export class PagoTransferencia {
  @PrimaryGeneratedColumn('identity', {
    name: 'ptr_id',
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  ptrId!: string;

  @Column({ name: 'pag_id', type: 'bigint' })
  pagId!: string;

  @OneToOne(() => Pago, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    cascade: false,
  })
  @JoinColumn({
    name: 'pag_id',
    referencedColumnName: 'pagId',
    foreignKeyConstraintName: 'fk_pago_transferencia_pago',
  })
  pago!: Pago;

  @Column({ name: 'ptr_banco', type: 'varchar', length: 60 })
  ptrBanco!: string;

  @Column({ name: 'ptr_numero_comprobante', type: 'varchar', length: 40 })
  ptrNumeroComprobante!: string;

  @Column({ name: 'ptr_fecha_transferencia', type: 'date' })
  ptrFechaTransferencia!: string;

  @Column({
    name: 'ptr_archivo_adjunto',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  ptrArchivoAdjunto!: string | null;
}
