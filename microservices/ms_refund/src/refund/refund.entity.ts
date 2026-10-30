import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reembolso')
@Index('uq_reembolso_correlation_id', ['rem_correlation_id'], { unique: true })
export class Refund {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  rem_id!: string;

  @Column({ type: 'bigint' })
  pag_id!: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  rem_numero!: string;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  rem_event_id!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  rem_monto!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  rem_motivo!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rem_referencia!: string | null;

  @Column({ type: 'varchar', length: 128, unique: true })
  rem_correlation_id!: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  rem_estado!: 'PENDIENTE' | 'PROCESADO';

  @Column({ type: 'timestamptz', nullable: true })
  rem_procesado_en!: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  rem_solicitado_en!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  rem_creado_en!: Date;
}
