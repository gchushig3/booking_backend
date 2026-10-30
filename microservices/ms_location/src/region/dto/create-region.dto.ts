import {
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  reg_nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'reg_codigo debe ser un codigo de 2 letras mayusculas',
  })
  reg_codigo: string;
}
