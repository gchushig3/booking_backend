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
import { CrearDetalleTarjetaRequestDto } from './dto/crear-detalle-tarjeta-request.dto.js';
import { DetalleTarjetaResponseDto } from './dto/detalle-tarjeta-response.dto.js';
import { PagoTarjeta } from './pago_tarjeta.entity.js';

@Injectable()
export class PagoTarjetaService {
  constructor(
    @InjectRepository(PagoTarjeta)
    private readonly detalleRepository: Repository<PagoTarjeta>,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    private readonly configService: ConfigService,
  ) {}

  async crear(
    pagoId: string,
    request: CrearDetalleTarjetaRequestDto,
  ): Promise<DetalleTarjetaResponseDto> {
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
          manager.getRepository(PagoTarjeta),
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
    request: CrearDetalleTarjetaRequestDto,
    detalleRepository: Repository<PagoTarjeta>,
    pagoRepository: Repository<Pago>,
  ): Promise<DetalleTarjetaResponseDto> {
    const pago = await this.obtenerPago(pagoId, pagoRepository);
    if (pago.metodoPago.mpaCodigo !== 'TARJETA') {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'PAYMENT_METHOD_MISMATCH',
        message: 'Card details require a TARJETA payment',
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
        message: 'Card details can only be added to a pending payment',
      });
    }

    const detalle = detalleRepository.create({
      pagId: pagoId,
      patMarca: request.marca,
      patUltimos4: request.ultimos4,
      patTitular: request.titular,
      patMes: request.mes,
      patAnio: request.anio,
      patPais: request.pais,
    });

    return this.toResponse(await detalleRepository.save(detalle));
  }

  async obtener(pagoId: string): Promise<DetalleTarjetaResponseDto> {
    await this.obtenerPago(pagoId);
    const detalle = await this.detalleRepository.findOneBy({ pagId: pagoId });
    if (!detalle) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Card details not found',
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
      message: 'A card detail already exists for this payment',
    });
  }

  private toResponse(detalle: PagoTarjeta): DetalleTarjetaResponseDto {
    return {
      id: detalle.patId,
      pago_id: detalle.pagId,
      marca: detalle.patMarca,
      ultimos4: detalle.patUltimos4,
      titular: detalle.patTitular,
      mes: detalle.patMes,
      anio: detalle.patAnio,
      pais: detalle.patPais,
    };
  }
}
