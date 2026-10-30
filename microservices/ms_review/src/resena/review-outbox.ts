import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfirmedEventPublisher } from '@booking/infrastructure';

interface OutboxRow {
  ro_seq: string;
  ro_event_id: string;
  ro_payload: Record<string, unknown>;
  ro_creado_en: Date;
}

export const DEFAULT_CATALOG_QUEUE = 'catalog.reviews';

@Injectable()
export class ReviewOutbox implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewOutbox.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly publisher: ConfirmedEventPublisher,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = Number(this.config.get('OUTBOX_POLL_MS') ?? 500);
    this.timer = setInterval(() => void this.flush(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // Reintenta lo pendiente; un fallo del broker solo pospone la fila (5 s).
  async flush(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rows: OutboxRow[] = await manager.query(
          `SELECT ro_seq, ro_event_id, ro_payload, ro_creado_en
             FROM review_outbox
            WHERE ro_publicado_en IS NULL AND ro_proximo_intento <= now()
            ORDER BY ro_seq LIMIT 20
              FOR UPDATE SKIP LOCKED`,
        );
        const queue =
          this.config.get<string>('AMQP_CATALOG_QUEUE') ??
          DEFAULT_CATALOG_QUEUE;
        let published = 0;
        for (const row of rows) {
          try {
            await this.publisher.publish(queue, {
              eventoId: row.ro_event_id,
              tipo: 'RESENA_PUBLICADA',
              fechaISO: new Date(row.ro_creado_en).toISOString(),
              origen: 'ms_review',
              correlationId: String(row.ro_payload.ren_id),
              data: { ...row.ro_payload, version: Number(row.ro_seq) },
            });
            await manager.query(
              `UPDATE review_outbox
                  SET ro_publicado_en = now(), ro_intentos = ro_intentos + 1
                WHERE ro_seq = $1`,
              [row.ro_seq],
            );
            published++;
          } catch (error) {
            this.logger.warn(
              `RESENA_PUBLICADA ${row.ro_event_id} reintentara: ${String(error)}`,
            );
            await manager.query(
              `UPDATE review_outbox
                  SET ro_intentos = ro_intentos + 1,
                      ro_proximo_intento = now() + interval '5 seconds'
                WHERE ro_seq = $1`,
              [row.ro_seq],
            );
          }
        }
        return published;
      });
    } catch (error) {
      this.logger.error(`Outbox flush fallo: ${String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
