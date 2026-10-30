import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Estado } from '../estado/estado.entity.js';
import { MetodoPago } from '../metodo_pago/metodo_pago.entity.js';
import { assertIsolatedTestWrite } from '../common/assert-isolated-test-write.js';
import { isPostgresUniqueViolation } from '../common/is-postgres-unique-violation.js';
import { PagoTarjeta } from '../pago_tarjeta/pago_tarjeta.entity.js';
import { CrearPagoRequestDto } from './dto/crear-pago-request.dto.js';
import { ListarPagosQueryDto } from './dto/listar-pagos-query.dto.js';
import { PaginaPagosResponseDto } from './dto/pagina-pagos-response.dto.js';
import { PagoResponseDto } from './dto/pago-response.dto.js';
import { SimularPagoRequestDto } from './dto/simular-pago-request.dto.js';
import { Pago } from './pago.entity.js';

@Injectable()
export class PagoService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    @InjectRepository(MetodoPago)
    private readonly metodoPagoRepository: Repository<MetodoPago>,
    @InjectRepository(Estado)
    private readonly estadoRepository: Repository<Estado>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(request: CrearPagoRequestDto): Promise<{
    status: HttpStatus.CREATED | HttpStatus.OK;
    pago: PagoResponseDto;
  }> {
    const nodeEnvironment = this.configService.getOrThrow<string>('NODE_ENV');
    if (nodeEnvironment === 'production') {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'SIMULATION_DISABLED',
        message: 'Simulated payments are disabled in production',
      });
    }
    assertIsolatedTestWrite(this.configService, nodeEnvironment);

    const existing = await this.findByNumber(request.numero);
    if (existing) {
      return this.resolveRetry(existing, request);
    }

    const metodoPago = await this.metodoPagoRepository.findOneBy({
      mpaCodigo: request.metodo_codigo,
    });
    if (!metodoPago || !metodoPago.mpaActivo) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'INVALID_PAYMENT_METHOD',
        message: 'Payment method does not exist or is inactive',
      });
    }

    const estadoPendiente = await this.estadoRepository.findOneBy({
      estCodigo: 'PENDIENTE',
    });
    if (!estadoPendiente || estadoPendiente.estFinal) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_CATALOG_INVALID',
        message: 'The PENDIENTE payment state is not configured correctly',
      });
    }

    const pago = this.pagoRepository.create({
      pagNumero: request.numero,
      ordId: request.orden_id,
      mpaId: metodoPago.mpaId,
      estId: estadoPendiente.estId,
      pagMonto: request.monto,
      pagReferencia: null,
      pagAutorizacion: null,
      pagAprobadoEn: null,
      pagRechazadoEn: null,
      pagMotivoRechazo: null,
    });

    try {
      const saved = await this.pagoRepository.save(pago);
      const complete = await this.findById(saved.pagId);
      if (!complete) {
        throw new InternalServerErrorException({
          statusCode: 500,
          code: 'PAYMENT_READ_AFTER_CREATE_FAILED',
          message: 'Created payment could not be loaded',
        });
      }

      return {
        status: HttpStatus.CREATED,
        pago: this.toResponse(complete),
      };
    } catch (error) {
      if (!isPostgresUniqueViolation(error)) {
        throw error;
      }

      const raced = await this.findByNumber(request.numero);
      if (!raced) {
        throw error;
      }
      return this.resolveRetry(raced, request);
    }
  }

  async listar(query: ListarPagosQueryDto): Promise<PaginaPagosResponseDto> {
    const queryBuilder = this.pagoRepository
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.metodoPago', 'metodoPago')
      .leftJoinAndSelect('pago.estado', 'estado');

    this.applyFilters(queryBuilder, query);
    queryBuilder
      .orderBy('pago.pagFecha', 'DESC')
      .addOrderBy('pago.pagId', 'DESC')
      .skip(query.offset)
      .take(query.limit);

    const [pagos, total] = await queryBuilder.getManyAndCount();
    return {
      items: pagos.map((pago) => this.toResponse(pago)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async obtenerPorId(id: string): Promise<PagoResponseDto> {
    const pago = await this.findById(id);
    if (!pago) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }

    return this.toResponse(pago);
  }

  async simular(
    id: string,
    request: SimularPagoRequestDto,
  ): Promise<PagoResponseDto> {
    const nodeEnvironment = this.configService.getOrThrow<string>('NODE_ENV');
    if (
      nodeEnvironment === 'production' ||
      this.configService.get<string>('SIMULATION_ENABLED') !== 'true'
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SIMULATION_DISABLED',
        message: 'Payment simulation is disabled',
      });
    }
    assertIsolatedTestWrite(this.configService, nodeEnvironment);

    try {
      return await this.dataSource.transaction(async (manager) =>
        this.applySimulation(manager, id, request),
      );
    } catch (error) {
      if (this.isApprovedOrderConflict(error)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ORDER_ALREADY_HAS_APPROVED_PAYMENT',
          message: 'Another payment for this order has already been approved',
        });
      }
      throw error;
    }
  }

  private async applySimulation(
    manager: EntityManager,
    id: string,
    request: SimularPagoRequestDto,
  ): Promise<PagoResponseDto> {
    const pagoRepository = manager.getRepository(Pago);
    const pago = await pagoRepository.findOne({
      where: { pagId: id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!pago) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Payment not found',
      });
    }

    const estadoRepository = manager.getRepository(Estado);
    const estadoActual = await estadoRepository.findOneBy({
      estId: pago.estId,
    });
    if (!estadoActual) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_CATALOG_INVALID',
        message: 'The current payment state is not configured',
      });
    }
    if (estadoActual.estCodigo !== 'PENDIENTE') {
      throw new ConflictException({
        statusCode: 409,
        code: 'PAYMENT_ALREADY_FINAL',
        message: 'Only pending payments can be simulated',
      });
    }

    const metodoPago = await manager.getRepository(MetodoPago).findOneBy({
      mpaId: pago.mpaId,
    });
    if (!metodoPago) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_CATALOG_INVALID',
        message: 'The payment method is not configured',
      });
    }
    if (
      metodoPago.mpaCodigo === 'TARJETA' &&
      !(await manager.getRepository(PagoTarjeta).findOneBy({ pagId: id }))
    ) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'CARD_DETAIL_REQUIRED',
        message:
          'Card details must be registered before simulating this payment',
      });
    }

    const estadoDestino = await estadoRepository.findOneBy({
      estCodigo: request.resultado,
    });
    if (!estadoDestino || !estadoDestino.estFinal) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_CATALOG_INVALID',
        message: 'The requested final payment state is not configured',
      });
    }

    const aprobado = request.resultado === 'APROBADO';
    const update = await manager
      .createQueryBuilder()
      .update(Pago)
      .set({
        estId: estadoDestino.estId,
        pagAprobadoEn: aprobado ? () => 'CURRENT_TIMESTAMP' : null,
        pagRechazadoEn: aprobado ? null : () => 'CURRENT_TIMESTAMP',
        pagMotivoRechazo: aprobado ? null : request.motivo!,
      })
      .where('"pag_id" = :id AND "est_id" = :pendingId', {
        id,
        pendingId: estadoActual.estId,
      })
      .execute();

    if (update.affected !== 1) {
      throw new ConflictException({
        statusCode: 409,
        code: 'PAYMENT_ALREADY_FINAL',
        message: 'Only pending payments can be simulated',
      });
    }

    const updated = await pagoRepository.findOne({
      where: { pagId: id },
      relations: { metodoPago: true, estado: true },
    });
    if (!updated) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_READ_AFTER_SIMULATION_FAILED',
        message: 'Simulated payment could not be loaded',
      });
    }
    return this.toResponse(updated);
  }

  private isApprovedOrderConflict(error: unknown): boolean {
    if (!isPostgresUniqueViolation(error)) {
      return false;
    }
    const driverError: unknown = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'constraint' in driverError &&
      driverError.constraint === 'ux_pago_orden_aprobado'
    );
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Pago>,
    query: ListarPagosQueryDto,
  ): void {
    if (query.ord_id !== undefined) {
      queryBuilder.andWhere('pago.ordId = :ordId', { ordId: query.ord_id });
    }
    if (query.estado !== undefined) {
      queryBuilder.andWhere('estado.estCodigo = :estado', {
        estado: query.estado,
      });
    }
    if (query.metodo !== undefined) {
      queryBuilder.andWhere('metodoPago.mpaCodigo = :metodo', {
        metodo: query.metodo,
      });
    }
  }

  private async findByNumber(numero: string): Promise<Pago | null> {
    return this.pagoRepository.findOne({
      where: { pagNumero: numero },
      relations: { metodoPago: true, estado: true },
    });
  }

  private async findById(id: string): Promise<Pago | null> {
    return this.pagoRepository.findOne({
      where: { pagId: id },
      relations: { metodoPago: true, estado: true },
    });
  }

  private resolveRetry(
    existing: Pago,
    request: CrearPagoRequestDto,
  ): { status: HttpStatus.OK; pago: PagoResponseDto } {
    if (
      existing.ordId !== request.orden_id ||
      existing.metodoPago?.mpaCodigo !== request.metodo_codigo ||
      existing.pagMonto !== request.monto
    ) {
      throw new ConflictException({
        statusCode: 409,
        code: 'PAYMENT_CONFLICT',
        message: 'pag_numero was already used with different payment data',
      });
    }

    return {
      status: HttpStatus.OK,
      pago: this.toResponse(existing),
    };
  }

  private toResponse(pago: Pago): PagoResponseDto {
    if (!pago.metodoPago || !pago.estado) {
      throw new InternalServerErrorException({
        statusCode: 500,
        code: 'PAYMENT_RELATION_MISSING',
        message: 'Payment catalog relations could not be loaded',
      });
    }

    return {
      id: pago.pagId,
      numero: pago.pagNumero,
      orden_id: pago.ordId,
      metodo: {
        id: pago.metodoPago.mpaId,
        codigo: pago.metodoPago.mpaCodigo,
        nombre: pago.metodoPago.mpaNombre,
        requiere_datos: pago.metodoPago.mpaRequiereDatos,
        activo: pago.metodoPago.mpaActivo,
      },
      estado: {
        id: pago.estado.estId,
        codigo: pago.estado.estCodigo,
        nombre: pago.estado.estNombre,
        final: pago.estado.estFinal,
      },
      monto: pago.pagMonto,
      referencia: pago.pagReferencia,
      autorizacion: pago.pagAutorizacion,
      fecha: pago.pagFecha.toISOString(),
      aprobado_en: pago.pagAprobadoEn?.toISOString() ?? null,
      rechazado_en: pago.pagRechazadoEn?.toISOString() ?? null,
      motivo_rechazo: pago.pagMotivoRechazo,
      creado_en: pago.pagCreadoEn.toISOString(),
      modo_simulacion:
        this.configService.getOrThrow<string>('NODE_ENV') === 'test'
          ? 'PRUEBAS'
          : 'DESARROLLO_LOCAL',
      orden_validacion: 'NO_VALIDADA',
    };
  }
}
