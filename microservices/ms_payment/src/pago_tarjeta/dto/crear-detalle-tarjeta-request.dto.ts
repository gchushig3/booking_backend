import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearDetalleTarjetaRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  marca!: string;

  @IsString()
  @Matches(/^[0-9]{4}$/)
  ultimos4!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titular!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  anio!: number;

  @IsString()
  @Matches(/^[A-Z]{2}$/)
  pais!: string;
}
