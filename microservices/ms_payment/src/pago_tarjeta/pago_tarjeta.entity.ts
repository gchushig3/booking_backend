import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Pago } from '../pago/pago.entity.js';

@Entity({ name: 'pago_tarjeta' })
@Unique('uq_pago_tarjeta_pag_id', ['pagId'])
@Check('pago_tarjeta_mes_valido', '"pat_mes" BETWEEN 1 AND 12')
@Check('pago_tarjeta_anio_valido', '"pat_anio" BETWEEN 2020 AND 2100')
@Check('pago_tarjeta_ultimos4_formato', `"pat_ultimos4" ~ '^[0-9]{4}$'`)
export class PagoTarjeta {
  @PrimaryGeneratedColumn('identity', {
    name: 'pat_id',
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  patId!: string;

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
    foreignKeyConstraintName: 'fk_pago_tarjeta_pago',
  })
  pago!: Pago;

  @Column({ name: 'pat_marca', type: 'varchar', length: 20 })
  patMarca!: string;

  @Column({ name: 'pat_ultimos4', type: 'char', length: 4 })
  patUltimos4!: string;

  @Column({ name: 'pat_titular', type: 'varchar', length: 120 })
  patTitular!: string;

  @Column({ name: 'pat_mes', type: 'smallint' })
  patMes!: number;

  @Column({ name: 'pat_anio', type: 'smallint' })
  patAnio!: number;

  @Column({ name: 'pat_pais', type: 'char', length: 2 })
  patPais!: string;
}
