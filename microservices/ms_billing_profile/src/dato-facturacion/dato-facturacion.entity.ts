import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// bigint llega como string desde pg; se conserva para no perder precision.
@Entity('dato_facturacion')
export class DatoFacturacion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  dfa_id: string;

  @Column({ type: 'bigint' })
  usu_id: string;

  @Column({ type: 'varchar', length: 20, default: 'CEDULA' })
  dfa_tipo_identificacion: string;

  @Column({ type: 'varchar', length: 20 })
  dfa_identificacion: string;

  @Column({ type: 'varchar', length: 150 })
  dfa_razon_social: string;

  @Column({ type: 'varchar', length: 160 })
  dfa_correo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dfa_telefono: string | null;

  @Column({ type: 'boolean', default: false })
  dfa_es_principal: boolean;

  @Column({ type: 'boolean', default: true })
  dfa_activo: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  dfa_creado_en: Date;
}
