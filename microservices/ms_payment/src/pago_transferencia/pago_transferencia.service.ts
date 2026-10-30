import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertIsolatedTestWrite } from '../common/assert-isolated-test-write.js';
import { isPostgresUniqueViolation } from '../common/is-postgres-unique-violation.js';
import { Pago } from '../pago/pago.entity.js';
import { CrearDetalleTransferenciaRequestDto } from './dto/crear-detalle-transferencia-request.dto.js';
import { DetalleTransferenciaResponseDto } from './dto/detalle-transferencia-response.dto.js';
import { PagoTransferencia } from './pago_transferencia.entity.js';

@Injectable()
export class PagoTransferenciaService {
  constructor(
    @InjectRepository(PagoTransferencia)
    private readonly detalleRepository: Repository<PagoTransferencia>,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    private readonly configService: ConfigService,
  ) {}

  async crear(
    pagoId: string,
    request: CrearDetalleTransferenciaRequestDto,
  ): Promise<DetalleTransferenciaResponseDto> {
    assertIsolatedTestWrite(this.configService);
    try {
      return await this.pagoRepository.manager.transaction(async (manager) => {
        const pagoRepository = manager.getRepository(Pago);
        // Lock the parent row before checking state, sharing simulation's lock.
        const locked = await pagoRepository.findOne({
          where: { pagId: pagoId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) {
          throw new NotFoundException({
            statusCode: 404,
            code: 'NOT_FOUND',
            message: 'Payment not found',
          });
        }
        return this.crearDetalle(
          pagoId,
          request,
          manager.getRepository(PagoTransferencia),
          pagoRepository,
        );
      });
    } catch (error) {
      // Resolve a unique collision only after the transaction has rolled back.
      if (
        isPostgresUniqueViolation(error) &&
        (await this.detalleRepository.findOneBy({ pagId: pagoId }))
      ) {
        throw this.duplicateDetailException();
      }
      throw error;
    }
  }

  private async crearDetalle(
    pagoId: string,
    request: CrearDetalleTransferenciaRequestDto,
    detalleRepository: Repository<PagoTransferencia>,
    pagoRepository: Repository<Pago>,
  ): Promise<DetalleTransferenciaResponseDto> {
    const pago = await this.obtenerPago(pagoId, pagoRepository);
    if (pago.metodoPago.mpaCodigo !== 'TRANSFERENCIA') {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'PAYMENT_METHOD_MISMATCH',
        message: 'Transfer details require a TRANSFERENCIA payment',
      });
    }
    const existing = await detalleRepository.findOneBy({ pagId: pagoId });
    if (existing) {
      throw this.duplicateDetailException();
    }

    if (pago.estado.estCodigo !== 'PENDIENTE') {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'PAYMENT_NOT_PENDING',
        message: 'Transfer details can only be added to a pending payment',
      });
    }

    const detalle = detalleRepository.create({
      pagId: pagoId,
      ptrBanco: request.banco,
      ptrNumeroComprobante: request.numero_comprobante,
      ptrFechaTransferencia: request.fecha_transferencia,
      ptrArchivoAdjunto: request.archivo_adjunto ?? null,
    });

    return this.toResponse(await detalleRepository.save(detalle));
  }

  async obtener(pagoId: string): Promise<DetalleTransferenciaResponseDto> {
    await this.obtenerPago(pagoId);
    const detalle = await this.detalleRepository.findOneBy({ pagId: pagoId });
    if (!detalle) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Transfer details not found',
      });
    }
    return this.toResponse(detalle);
  }

  private async obtenerPago(
    pagoId: string,
    pagoRepository = this.pagoRepository,
  ): Promise<Pago> {
    const pago = await pagoRepository.findOne({
      where: { pagId: pagoId },
      relations: { metodoPago: true, estado: true },
    });
    if (!pago) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }
    return pago;
  }

  private duplicateDetailException(): ConflictException {
    return new ConflictException({
      statusCode: 409,
      code: 'DETAIL_ALREADY_EXISTS',
      message: 'A transfer detail already exists for this payment',
    });
  }

  private toResponse(
    detalle: PagoTransferencia,
  ): DetalleTransferenciaResponseDto {
    return {
      id: detalle.ptrId,
      pago_id: detalle.pagId,
      banco: detalle.ptrBanco,
      numero_comprobante: detalle.ptrNumeroComprobante,
      fecha_transferencia: detalle.ptrFechaTransferencia,
      archivo_adjunto: detalle.ptrArchivoAdjunto,
    };
  }
}
