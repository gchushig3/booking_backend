import { EstadoPagoResponseDto } from '../../estado/dto/estado-pago-response.dto.js';
import { MetodoPagoResponseDto } from '../../metodo_pago/dto/metodo-pago-response.dto.js';

export class PagoResponseDto {
  id!: string;
  numero!: string;
  orden_id!: string;
  metodo!: MetodoPagoResponseDto;
  estado!: EstadoPagoResponseDto;
  monto!: string;
  referencia!: string | null;
  autorizacion!: string | null;
  fecha!: string;
  aprobado_en!: string | null;
  rechazado_en!: string | null;
  motivo_rechazo!: string | null;
  creado_en!: string;
  modo_simulacion!: 'DESARROLLO_LOCAL' | 'PRUEBAS';
  orden_validacion!: 'NO_VALIDADA';
}
