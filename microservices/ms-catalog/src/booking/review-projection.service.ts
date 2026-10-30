import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ReviewPublishedData {
  atr_id: string;
  promedio: number;
  total: number;
  version: number;
}

export class InvalidReviewEventError extends Error {}

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

export function parseReviewEvent(event: unknown): ReviewPublishedData {
  const data = (event as { data?: Record<string, unknown> } | null)?.data;
  if (
    !data ||
    !POSITIVE_INTEGER.test(String(data.atr_id)) ||
    typeof data.promedio !== 'number' ||
    !(data.promedio >= 0 && data.promedio <= 5) ||
    !Number.isInteger(data.total) ||
    (data.total as number) < 0 ||
    !Number.isInteger(data.version) ||
    (data.version as number) < 1
  ) {
    throw new InvalidReviewEventError('RESENA_PUBLICADA invalido');
  }
  return {
    atr_id: String(data.atr_id),
    promedio: data.promedio,
    total: data.total as number,
    version: data.version as number,
  };
}

@Injectable()
export class ReviewProjectionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Una sola sentencia: solo aplica versiones mas nuevas (duplicados y
  // entregas desordenadas se ignoran). Devuelve true si cambio la proyeccion.
  async apply(event: unknown): Promise<boolean> {
    const review = parseReviewEvent(event);
    try {
      const rows: unknown[] = await this.dataSource.query(
        `WITH aplicado AS (
           INSERT INTO resena_proyeccion (atr_id, version)
           VALUES ($1, $4)
           ON CONFLICT (atr_id) DO UPDATE
             SET version = EXCLUDED.version, updated_at = now()
             WHERE resena_proyeccion.version < EXCLUDED.version
           RETURNING atr_id
         )
         UPDATE atraccion
            SET atr_calificacion_promedio = $2, atr_numero_resenas = $3
          WHERE atr_id IN (SELECT atr_id FROM aplicado)
          RETURNING atr_id`,
        [review.atr_id, review.promedio, review.total, review.version],
      );
      return rows.length > 0;
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23503'
      ) {
        throw new InvalidReviewEventError('Atraccion inexistente');
      }
      throw error;
    }
  }
}
