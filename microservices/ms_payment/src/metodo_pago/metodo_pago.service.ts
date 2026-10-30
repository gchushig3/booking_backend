import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetodoPago } from './metodo_pago.entity.js';
import { MetodoPagoResponseDto } from './dto/metodo-pago-response.dto.js';

@Injectable()
export class MetodoPagoService {
  constructor(
    @InjectRepository(MetodoPago)
    private readonly metodoPagoRepository: Repository<MetodoPago>,
  ) {}

  async listar(activo?: boolean): Promise<MetodoPagoResponseDto[]> {
    const metodos = await this.metodoPagoRepository.find({
      where: activo === undefined ? {} : { mpaActivo: activo },
      order: { mpaId: 'ASC' },
    });

    return metodos.map((metodo) => this.toResponse(metodo));
  }

  async obtenerPorId(id: number): Promise<MetodoPagoResponseDto> {
    const metodo = await this.metodoPagoRepository.findOneBy({ mpaId: id });
    if (!metodo) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    return this.toResponse(metodo);
  }

  private toResponse(metodo: MetodoPago): MetodoPagoResponseDto {
    return {
      id: metodo.mpaId,
      codigo: metodo.mpaCodigo,
      nombre: metodo.mpaNombre,
      requiere_datos: metodo.mpaRequiereDatos,
      activo: metodo.mpaActivo,
    };
  }
}
