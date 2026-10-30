import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('provincia')
export class Provincia {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  prov_id: number;

  @Column({ type: 'varchar', length: 60 })
  prov_nombre: string;

  @Column({ type: 'char', length: 2 })
  prov_codigo: string;

  @Column({ type: 'smallint' })
  reg_id: number;

  @Column({ type: 'boolean', default: true })
  prov_activa: boolean;
}
