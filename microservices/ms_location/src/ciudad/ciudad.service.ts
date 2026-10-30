import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ciudad } from './ciudad.entity.js';
import { CreateCiudadDto } from './dto/create-ciudad.dto.js';
import { UpdateCiudadDto } from './dto/update-ciudad.dto.js';

@Injectable()
export class CiudadService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadesRepository: Repository<Ciudad>,
  ) {}

  findAll(provId?: number): Promise<Ciudad[]> {
    if (provId === undefined) {
      return this.ciudadesRepository.find({ order: { ciu_id: 'ASC' } });
    }
    return this.ciudadesRepository.find({
      where: { prov_id: provId },
      order: { ciu_id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Ciudad> {
    const ciudad = await this.ciudadesRepository.findOneBy({ ciu_id: id });
    if (!ciudad) {
      throw new NotFoundException(`Ciudad con id ${id} no existe`);
    }
    return ciudad;
  }

  create(createCiudadDto: CreateCiudadDto): Promise<Ciudad> {
    const ciudad = this.ciudadesRepository.create(createCiudadDto);
    return this.ciudadesRepository.save(ciudad);
  }

  async update(id: number, updateCiudadDto: UpdateCiudadDto): Promise<Ciudad> {
    const ciudad = await this.findOne(id);
    const data = this.ciudadesRepository.create({
      ...ciudad,
      ...updateCiudadDto,
    });
    return this.ciudadesRepository.save(data);
  }

  async remove(id: number): Promise<void> {
    const ciudad = await this.findOne(id);
    await this.ciudadesRepository.remove(ciudad);
  }
}
