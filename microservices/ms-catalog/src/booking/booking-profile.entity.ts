import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AtraccionEntity } from '../database/entities/atraccion.entity.js';

export interface BookingProfile {
  city: string;
  price: {
    currency: string;
    adult: number;
    child: number;
    senior: number;
    infant: number;
    student?: number;
  };
  inclusions: {
    includes_food: boolean;
    includes_transport: boolean;
    includes_guide: boolean;
  };
  itinerary: Array<{
    stop_number: number;
    time: string;
    title: string;
    duration_minutes: number;
  }>;
  ratings_breakdown: Record<string, number>;
  accessibility?: {
    wheelchair_accessible?: boolean;
    service_animals_allowed?: boolean;
  };
  permite_paquete?: boolean;
  schedule_times?: string[];
}

/** Proyeccion local del contrato Booking; no reemplaza tarifas ni horarios de sus servicios. */
@Entity({ name: 'booking_attraction_profile', synchronize: false })
export class BookingProfileEntity {
  @PrimaryColumn({ type: 'bigint' }) atr_id!: string;
  @Column({ type: 'jsonb' }) payload!: BookingProfile;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @OneToOne(() => AtraccionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atr_id' })
  attraction!: Relation<AtraccionEntity>;
}
