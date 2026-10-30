import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionIdiomaEntity } from './atraccion-idioma.entity.js';

@Entity({ name: 'idioma', synchronize: false })
@Unique('idioma_idi_codigo_key', ['idi_codigo'])
export class IdiomaEntity {
  @PrimaryGeneratedColumn('identity', {
    type: 'smallint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'idioma_pkey',
  })
  idi_id!: number;

  @Column({ type: 'char', length: 2 })
  idi_codigo!: string;

  @Column({ type: 'varchar', length: 50 })
  idi_nombre!: string;

  @OneToMany(() => AtraccionIdiomaEntity, (value) => value.idioma, {
    cascade: false,
  })
  atracciones!: Relation<AtraccionIdiomaEntity[]>;
}
