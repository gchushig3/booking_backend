import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('atraccion_ubicacion')
export class AttractionLocation {
  @PrimaryColumn({ type: 'bigint' })
  atr_id!: string;

  @Column({ type: 'smallint' })
  ciu_id!: number;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  geo_latitud!: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  geo_longitud!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  geo_direccion!: string | null;
}
