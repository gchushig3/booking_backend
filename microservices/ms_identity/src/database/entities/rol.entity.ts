import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
@Entity({ name: 'rol', synchronize: false })
@Unique('rol_rol_nombre_key', ['rol_nombre'])
export class RolEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'smallint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'rol_pkey',
  })
  rol_id!: number;
  @Column({ type: 'varchar', length: 30 })
  rol_nombre!: string;
  @Column({ type: 'varchar', length: 200 })
  rol_descripcion!: string;
  @Column({ type: 'boolean', default: true })
  rol_activo!: boolean;
}
