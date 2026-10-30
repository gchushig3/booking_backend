import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty } from 'class-validator';
import { resolveUpperString } from '../../../common/dto/dto-utils.js';

export class UpdateAttractionStatusDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'estado'),
  )
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsIn(['BORRADOR', 'PUBLICADA', 'INACTIVA'], {
    message: 'El estado debe ser BORRADOR, PUBLICADA o INACTIVA',
  })
  @ApiProperty({
    type: String,
    minLength: 1,
    enum: ['BORRADOR', 'PUBLICADA', 'INACTIVA'],
    example: 'BORRADOR',
  })
  status!: string;
}
