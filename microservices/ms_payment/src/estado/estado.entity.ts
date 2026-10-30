import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'estado' })
export class Estado {
  @PrimaryGeneratedColumn('identity', {
    name: 'est_id',
    type: 'smallint',
    generatedIdentity: 'ALWAYS',
  })
  estId!: number;

  @Column({ name: 'est_codigo', type: 'varchar', length: 20, unique: true })
  estCodigo!: string;

  @Column({ name: 'est_nombre', type: 'varchar', length: 50 })
  estNombre!: string;

  @Column({ name: 'est_final', type: 'boolean', default: false })
  estFinal!: boolean;
}
