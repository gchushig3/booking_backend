import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { IsBigIntId } from '../../common/validation/bigint-id.validation.js';

const ESTADOS_PAGO = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'FALLIDO'];
const METODOS_PAGO = ['TARJETA', 'TRANSFERENCIA', 'EN_SITIO', 'PAYPHAL'];

export class ListarPagosQueryDto {
  @ValidateIf((_request, value: unknown) => value !== undefined)
  @IsBigIntId()
  ord_id?: string;

  @IsOptional()
  @IsIn(ESTADOS_PAGO)
  estado?: string;

  @IsOptional()
  @IsIn(METODOS_PAGO)
  metodo?: string;

  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsInt()
  @Min(0)
  offset = 0;
}
