import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mensaje_contacto')
export class Mensaje {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  men_id: string;

  @Column({ type: 'varchar', length: 120 })
  men_nombre: string;

  @Column({ type: 'varchar', length: 160 })
  men_correo: string;

  @Column({ type: 'varchar', length: 30 })
  men_asunto: string;

  @Column({ type: 'varchar', length: 2000 })
  men_cuerpo: string;

  @Column({ type: 'boolean', default: false })
  men_leido: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  men_creado_en: Date;
}
