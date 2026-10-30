import { PartialType } from '@nestjs/swagger';
import { CreateCiudadDto } from './create-ciudad.dto.js';

export class UpdateCiudadDto extends PartialType(CreateCiudadDto) {}
