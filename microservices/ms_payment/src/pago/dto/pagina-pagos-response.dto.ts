import { PagoResponseDto } from './pago-response.dto.js';

export class PaginaPagosResponseDto {
  items!: PagoResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
}
