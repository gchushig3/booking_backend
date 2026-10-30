import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provincia } from './provincia.entity.js';
import { CreateProvinciaDto } from './dto/create-provincia.dto.js';
import { UpdateProvinciaDto } from './dto/update-provincia.dto.js';

@Injectable()
export class ProvinciaService {
  constructor(
    @InjectRepository(Provincia)
    private readonly provinciasRepository: Repository<Provincia>,
  ) {}

  findAll(regId?: number): Promise<Provincia[]> {
    if (regId === undefined) {
      return this.provinciasRepository.find({ order: { prov_id: 'ASC' } });
    }
    return this.provinciasRepository.find({
      where: { reg_id: regId },
      order: { prov_id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Provincia> {
    const provincia = await this.provinciasRepository.findOneBy({
      prov_id: id,
    });
    if (!provincia) {
      throw new NotFoundException(`Provincia con id ${id} no existe`);
    }
    return provincia;
  }

  create(createProvinciaDto: CreateProvinciaDto): Promise<Provincia> {
    const provincia = this.provinciasRepository.create(createProvinciaDto);
    return this.provinciasRepository.save(provincia);
  }

  async update(
    id: number,
    updateProvinciaDto: UpdateProvinciaDto,
  ): Promise<Provincia> {
    const provincia = await this.findOne(id);
    const data = this.provinciasRepository.create({
      ...provincia,
      ...updateProvinciaDto,
    });
    return this.provinciasRepository.save(data);
  }

  async remove(id: number): Promise<void> {
    const provincia = await this.findOne(id);
    await this.provinciasRepository.remove(provincia);
  }
}
