import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Resena } from './resena.entity.js';
import type { ResenaInput } from './resena.schemas.js';

const isUniqueViolation = (error: unknown) =>
  (error as { driverError?: { code?: string } })?.driverError?.code === '23505';
@Injectable()
export class ResenaService {
  constructor(
    @InjectRepository(Resena) private readonly repository: Repository<Resena>,
    private readonly dataSource: DataSource,
  ) {}

  listVisible(atrId: string): Promise<Resena[]> {
    return this.repository.find({
      where: { atr_id: atrId, ren_visible: true },
      order: { ren_id: 'DESC' },
      take: 100,
    });
  }

  async create(userId: string, input: ResenaInput): Promise<Resena> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.lockAttraction(manager, input.atr_id);
        const resena = await manager.save(
          manager.create(Resena, { ...input, usu_id: userId }),
        );
        await this.enqueue(manager, resena);
        return resena;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una resena de este usuario');
      }
      throw error;
    }
  }

  async setVisible(id: string, visible: boolean): Promise<Resena> {
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneBy(Resena, { ren_id: id });
      if (!current) throw new NotFoundException('Resena no existe');
      await this.lockAttraction(manager, current.atr_id);
      current.ren_visible = visible;
      const saved = await manager.save(current);
      await this.enqueue(manager, saved);
      return saved;
    });
  }

  // Serializa por atraccion para que el orden de version siga al de commit.
  private lockAttraction(manager: EntityManager, atrId: string) {
    return manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [atrId]);
  }

  // Misma transaccion que la resena: el evento nunca se pierde ni se duplica.
  private async enqueue(manager: EntityManager, resena: Resena): Promise<void> {
    const [stats] = await manager.query(
      `SELECT COALESCE(ROUND(AVG(ren_puntuacion)::numeric, 2), 0) AS promedio,
              COUNT(*)::int AS total
         FROM resena WHERE atr_id = $1 AND ren_visible`,
      [resena.atr_id],
    );
    await manager.query(
      `INSERT INTO review_outbox (atr_id, ro_payload) VALUES ($1, $2::jsonb)`,
      [
        resena.atr_id,
        JSON.stringify({
          atr_id: resena.atr_id,
          ren_id: resena.ren_id,
          ren_puntuacion: resena.ren_puntuacion,
          ren_visible: resena.ren_visible,
          promedio: Number(stats.promedio),
          total: Number(stats.total),
        }),
      ],
    );
  }
}
