export class DetalleTransferenciaResponseDto {
  id!: string;
  pago_id!: string;
  banco!: string;
  numero_comprobante!: string;
  fecha_transferencia!: string;
  archivo_adjunto!: string | null;
}
