import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearDetalleTransferenciaRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  banco!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  numero_comprobante!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fecha_transferencia!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  archivo_adjunto?: string | null;
}
