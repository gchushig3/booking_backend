import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ciudad')
export class Ciudad {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  ciu_id: number;

  @Column({ type: 'varchar', length: 80 })
  ciu_nombre: string;

  @Column({ type: 'char', length: 6 })
  ciu_codigo: string;

  @Column({ type: 'smallint' })
  prov_id: number;

  @Column({ type: 'boolean', default: true })
  ciu_activa: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ciu_descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ciu_imagen: string;
}
