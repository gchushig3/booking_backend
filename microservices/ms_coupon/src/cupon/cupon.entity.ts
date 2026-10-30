import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cupon')
export class Cupon {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  cup_id: string;

  @Column({ type: 'varchar', length: 30 })
  cup_codigo: string;

  @Column({ type: 'varchar', length: 20 })
  cup_tipo: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  cup_valor: string;

  @Column({ type: 'date' })
  cup_fecha_inicio: string;

  @Column({ type: 'date', nullable: true })
  cup_fecha_fin: string | null;

  @Column({ type: 'integer', nullable: true })
  cup_usos_max: number | null;

  @Column({ type: 'boolean', default: true })
  cup_activo: boolean;
}
