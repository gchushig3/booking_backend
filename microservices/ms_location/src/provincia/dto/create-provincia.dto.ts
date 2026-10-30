import {
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProvinciaDto {
  @IsInt()
  @Min(1)
  @Max(32767)
  reg_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  prov_nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  @Matches(/^[0-9]{2}$/, {
    message: 'prov_codigo debe ser un codigo de 2 digitos',
  })
  prov_codigo: string;
}
