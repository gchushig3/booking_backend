import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  OnModuleInit,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { PublicEndpoint } from '../../common/public-endpoint.decorator.js';

interface ReservationInput {
  atraccion_id: string;
  fecha: string;
  hora: string;
  personas: number;
  cliente_nombre: string;
  cliente_email: string;
}

function parseReservation(body: unknown): ReservationInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = String(b.atraccion_id ?? b.attraction_id ?? '');
  const fecha = String(b.fecha ?? b.date ?? '');
  const hora = String(b.hora ?? b.time ?? '09:00');
  const personas = Number(b.personas ?? b.quantity);
  const nombre = String(b.cliente_nombre ?? b.customer_name ?? '').trim();
  const email = String(b.cliente_email ?? b.customer_email ?? '').trim();
  if (!/^[1-9]\d{0,17}$/.test(id))
    throw new BadRequestException('atraccion_id invalido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
    throw new BadRequestException('fecha invalida (YYYY-MM-DD)');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
    throw new BadRequestException('hora invalida (HH:MM)');
  if (!Number.isInteger(personas) || personas < 1 || personas > 100)
    throw new BadRequestException('personas debe ser un entero entre 1 y 100');
  if (!nombre || nombre.length > 200)
    throw new BadRequestException('cliente_nombre invalido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    throw new BadRequestException('cliente_email invalido');
  return {
    atraccion_id: id,
    fecha,
    hora,
    personas,
    cliente_nombre: nombre,
    cliente_email: email,
  };
}

/** Contrato de integracion con Booking; debe registrarse antes de `:id`. */
@ApiTags('Booking')
@Controller('atracciones')
export class BookingContractController implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS reserva_atraccion (
        res_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        res_uuid uuid NOT NULL DEFAULT gen_random_uuid(),
        atr_id bigint NOT NULL REFERENCES atraccion(atr_id),
        res_fecha date NOT NULL,
        res_hora time NOT NULL,
        res_personas integer NOT NULL CHECK (res_personas > 0),
        res_cliente_nombre varchar(200) NOT NULL,
        res_cliente_email varchar(200) NOT NULL,
        res_estado varchar(20) NOT NULL DEFAULT 'CONFIRMADA',
        res_creada_en timestamptz NOT NULL DEFAULT now()
      )`);
  }

  @PublicEndpoint()
  @Get('health')
  @ApiOperation({ summary: 'Health check para Booking (incluye PostgreSQL)' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'UP' },
        database_connected: { type: 'boolean', example: true },
        service: { type: 'string', example: 'Atracciones' },
      },
    },
  })
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'DOWN',
        database_connected: false,
        service: 'Atracciones',
      });
    }
    return { status: 'UP', database_connected: true, service: 'Atracciones' };
  }

  @PublicEndpoint()
  @Post('reservas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una reserva de atraccion desde Booking' })
  async createReservation(@Body() body: unknown) {
    const input = parseReservation(body);
    const found: Array<{ atr_nombre: string }> = await this.dataSource.query(
      `SELECT atr_nombre FROM atraccion
       WHERE atr_id = $1 AND atr_estado = 'PUBLICADA' AND atr_eliminado_en IS NULL`,
      [input.atraccion_id],
    );
    if (!found.length) throw new NotFoundException('Atraccion no disponible');
    const rows: Array<{ res_uuid: string; res_estado: string }> =
      await this.dataSource.query(
        `INSERT INTO reserva_atraccion
           (atr_id, res_fecha, res_hora, res_personas, res_cliente_nombre, res_cliente_email)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING res_uuid, res_estado`,
        [
          input.atraccion_id,
          input.fecha,
          input.hora,
          input.personas,
          input.cliente_nombre,
          input.cliente_email,
        ],
      );
    return {
      reserva_id: rows[0]!.res_uuid,
      estado: rows[0]!.res_estado,
      atraccion_id: input.atraccion_id,
      atraccion: found[0]!.atr_nombre,
      fecha: input.fecha,
      hora: input.hora,
      personas: input.personas,
    };
  }
}
