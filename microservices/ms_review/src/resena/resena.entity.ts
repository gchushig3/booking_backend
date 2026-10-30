import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// bigint llega como string desde pg; se conserva para no perder precision.
@Entity('resena')
export class Resena {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  ren_id: string;

  @Column({ type: 'bigint' })
  atr_id: string;

  @Column({ type: 'bigint', nullable: true })
  usu_id: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ren_autor_nombre: string | null;

  @Column({ type: 'smallint' })
  ren_puntuacion: number;

  @Column({ type: 'varchar', length: 1000 })
  ren_comentario: string;

  @Column({ type: 'boolean', default: true })
  ren_visible: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  ren_creado_en: Date;
}
