import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('region')
export class Region {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  reg_id: number;

  @Column({ type: 'varchar', length: 30 })
  reg_nombre: string;

  @Column({ type: 'char', length: 2 })
  reg_codigo: string;
}
