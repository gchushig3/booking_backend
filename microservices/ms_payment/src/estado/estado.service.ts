import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estado } from './estado.entity.js';
import { EstadoPagoResponseDto } from './dto/estado-pago-response.dto.js';

@Injectable()
export class EstadoService {
  constructor(
    @InjectRepository(Estado)
    private readonly estadoRepository: Repository<Estado>,
  ) {}

  async listar(): Promise<EstadoPagoResponseDto[]> {
    const estados = await this.estadoRepository.find({
      order: { estId: 'ASC' },
    });

    return estados.map((estado) => this.toResponse(estado));
  }

  async obtenerPorId(id: number): Promise<EstadoPagoResponseDto> {
    const estado = await this.estadoRepository.findOneBy({ estId: id });
    if (!estado) {
      throw new NotFoundException('Estado de pago no encontrado');
    }

    return this.toResponse(estado);
  }

  private toResponse(estado: Estado): EstadoPagoResponseDto {
    return {
      id: estado.estId,
      codigo: estado.estCodigo,
      nombre: estado.estNombre,
      final: estado.estFinal,
    };
  }
}
