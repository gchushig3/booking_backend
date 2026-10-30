import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCiudadDto {
  @IsInt()
  @Min(1)
  @Max(32767)
  prov_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  ciu_nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, {
    message: 'ciu_codigo debe ser un codigo de 6 digitos',
  })
  ciu_codigo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ciu_descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ciu_imagen?: string;
}
