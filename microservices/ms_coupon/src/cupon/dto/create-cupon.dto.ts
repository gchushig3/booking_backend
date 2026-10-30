import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCuponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  cup_codigo: string;

  @IsIn(['PORCENTAJE', 'FIJO'])
  cup_tipo: string;

  @IsNumber()
  @Min(0)
  @Max(100, {
    message: 'El valor del descuento en porcentaje debe estar entre 0 y 100',
  })
  @ValidateIf((o) => o.cup_tipo === 'PORCENTAJE')
  cup_valor: number;

  @IsDateString()
  cup_fecha_inicio: Date;

  @IsOptional()
  @IsDateString()
  cup_fecha_fin?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  cup_usos_max?: number;

  @IsOptional()
  @IsBoolean()
  cup_activo?: boolean;
}
