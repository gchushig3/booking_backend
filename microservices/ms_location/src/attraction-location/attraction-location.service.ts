import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AttractionLocation } from './attraction-location.entity.js';

export interface AttractionLocationInput {
  ciu_id: number;
  geo_latitud: number;
  geo_longitud: number;
  geo_direccion?: string;
}

@Injectable()
export class AttractionLocationService {
  constructor(
    @InjectRepository(AttractionLocation)
    private readonly repository: Repository<AttractionLocation>,
    private readonly dataSource: DataSource,
  ) {}

  async get(atrId: string): Promise<Record<string, unknown>> {
    const [location] = await this.dataSource.query(
      `SELECT u.atr_id, u.ciu_id, u.geo_latitud, u.geo_longitud,
              u.geo_direccion, c.ciu_nombre, p.prov_nombre, r.reg_nombre
         FROM atraccion_ubicacion u
         JOIN ciudad c ON c.ciu_id = u.ciu_id
         JOIN provincia p ON p.prov_id = c.prov_id
         JOIN region r ON r.reg_id = p.reg_id
        WHERE u.atr_id = $1 AND c.ciu_activa AND p.prov_activa`,
      [atrId],
    );
    if (!location) throw new NotFoundException('Ubicacion no encontrada');
    return location;
  }

  async upsert(
    atrId: string,
    input: AttractionLocationInput,
  ): Promise<AttractionLocation> {
    await this.dataSource
      .query('SELECT ciu_id FROM ciudad WHERE ciu_id = $1 AND ciu_activa', [
        input.ciu_id,
      ])
      .then((rows: unknown[]) => {
        if (!rows.length) throw new NotFoundException('Ciudad no encontrada');
      });
    const location = this.repository.create({
      atr_id: atrId,
      ciu_id: input.ciu_id,
      geo_latitud: input.geo_latitud.toFixed(6),
      geo_longitud: input.geo_longitud.toFixed(6),
      geo_direccion: input.geo_direccion ?? null,
    });
    await this.repository.upsert(location, ['atr_id']);
    return this.repository.findOneByOrFail({ atr_id: atrId });
  }
}
