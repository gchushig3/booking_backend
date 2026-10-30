import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SagaBus } from '@booking/infrastructure';
import { Repository } from 'typeorm';
import { Refund } from './refund.entity.js';
import {
  InvalidRefundEventError,
  type RefundConfirmation,
  type RefundRequest,
} from './refund.schemas.js';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund) private readonly repository: Repository<Refund>,
    private readonly bus: SagaBus,
  ) {}

  list(): Promise<Refund[]> {
    return this.repository.find({ order: { rem_id: 'DESC' }, take: 100 });
  }

  async request(input: RefundRequest): Promise<Refund> {
    let refund = await this.repository.findOneBy({
      rem_correlation_id: input.correlationId,
    });
    if (!refund) {
      try {
        refund = await this.repository.save(
          this.repository.create({
            pag_id: input.pag_id,
            rem_numero: input.rem_numero,
            rem_monto: input.rem_monto.toFixed(2),
            rem_motivo: input.rem_motivo ?? null,
            rem_correlation_id: input.correlationId,
          }),
        );
      } catch (error) {
        if (
          (error as { driverError?: { code?: string } })?.driverError?.code ===
          '23505'
        ) {
          throw new ConflictException('El reembolso o correlationId ya existe');
        }
        throw error;
      }
    } else if (
      refund.pag_id !== input.pag_id ||
      Number(refund.rem_monto) !== input.rem_monto
    ) {
      throw new ConflictException('El correlationId ya tiene otra solicitud');
    }

    if (refund.rem_estado === 'PENDIENTE') {
      try {
        await this.bus.publish({
          eventoId: refund.rem_event_id,
          tipo: 'reembolso.solicitado',
          fechaISO: new Date(refund.rem_solicitado_en).toISOString(),
          origen: 'ms_refund',
          correlationId: refund.rem_correlation_id,
          data: {
            pag_id: refund.pag_id,
            rem_id: refund.rem_id,
            rem_numero: refund.rem_numero,
            rem_monto: Number(refund.rem_monto),
            rem_motivo: refund.rem_motivo,
          },
        });
      } catch (error) {
        this.logger.error(
          `No se pudo publicar solicitud ${refund.rem_id}: ${String(error)}`,
        );
        throw new ServiceUnavailableException(
          'Solicitud guardada; reintente con el mismo correlationId',
        );
      }
    }
    return refund;
  }

  async confirm(event: RefundConfirmation): Promise<void> {
    const refund = await this.repository.findOneBy({
      rem_correlation_id: event.correlationId,
    });
    if (!refund) {
      throw new InvalidRefundEventError(
        `No existe solicitud de reembolso ${event.correlationId}`,
      );
    }
    if (refund.rem_estado !== 'PROCESADO') {
      refund.rem_estado = 'PROCESADO';
      refund.rem_procesado_en = new Date(event.fechaISO);
      refund.rem_referencia =
        typeof event.data.rem_referencia === 'string'
          ? event.data.rem_referencia.slice(0, 100)
          : null;
      await this.repository.save(refund);
    }
  }
}
