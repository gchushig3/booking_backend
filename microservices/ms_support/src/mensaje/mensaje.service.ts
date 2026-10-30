import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mensaje } from './mensaje.entity.js';
import type { MensajeInput } from './mensaje.schemas.js';

@Injectable()
export class MensajeService {
  constructor(
    @InjectRepository(Mensaje)
    private readonly repository: Repository<Mensaje>,
  ) {}

  list(leido?: boolean): Promise<Mensaje[]> {
    return this.repository.find({
      where: leido === undefined ? {} : { men_leido: leido },
      order: { men_id: 'ASC' },
    });
  }

  async get(id: string): Promise<Mensaje> {
    const mensaje = await this.repository.findOneBy({ men_id: id });
    if (!mensaje) throw new NotFoundException('Mensaje no existe');
    return mensaje;
  }

  create(input: MensajeInput): Promise<Mensaje> {
    return this.repository.save(this.repository.create(input));
  }

  async markRead(id: string, leido: boolean): Promise<Mensaje> {
    const mensaje = await this.get(id);
    mensaje.men_leido = leido;
    return this.repository.save(mensaje);
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(await this.get(id));
  }
}
