import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from './region.entity.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { UpdateRegionDto } from './dto/update-region.dto.js';

@Injectable()
export class RegionService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepository: Repository<Region>,
  ) {}

  findAll(): Promise<Region[]> {
    return this.regionsRepository.find({ order: { reg_id: 'ASC' } });
  }

  async findOne(id: number): Promise<Region> {
    const region = await this.regionsRepository.findOneBy({ reg_id: id });
    if (!region) {
      throw new NotFoundException(`Region con id ${id} no existe`);
    }
    return region;
  }

  create(createRegionDto: CreateRegionDto): Promise<Region> {
    const region = this.regionsRepository.create(createRegionDto);
    return this.regionsRepository.save(region);
  }

  async update(id: number, updateRegionDto: UpdateRegionDto): Promise<Region> {
    const region = await this.findOne(id);
    const data = this.regionsRepository.create({
      ...region,
      ...updateRegionDto,
    });
    return this.regionsRepository.save(data);
  }

  async remove(id: number): Promise<void> {
    const region = await this.findOne(id);
    await this.regionsRepository.remove(region);
  }
}
