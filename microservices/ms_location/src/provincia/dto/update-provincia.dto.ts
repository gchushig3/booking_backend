import { PartialType } from '@nestjs/swagger';
import { CreateProvinciaDto } from './create-provincia.dto.js';

export class UpdateProvinciaDto extends PartialType(CreateProvinciaDto) {}
