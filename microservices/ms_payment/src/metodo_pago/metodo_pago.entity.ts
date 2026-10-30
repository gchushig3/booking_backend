import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'metodo_pago' })
export class MetodoPago {
  @PrimaryGeneratedColumn('identity', {
    name: 'mpa_id',
    type: 'smallint',
    generatedIdentity: 'ALWAYS',
  })
  mpaId!: number;

  @Column({ name: 'mpa_codigo', type: 'varchar', length: 20, unique: true })
  mpaCodigo!: string;

  @Column({ name: 'mpa_nombre', type: 'varchar', length: 60 })
  mpaNombre!: string;

  @Column({ name: 'mpa_requiere_datos', type: 'boolean', default: false })
  mpaRequiereDatos!: boolean;

  @Column({ name: 'mpa_activo', type: 'boolean', default: true })
  mpaActivo!: boolean;
}
