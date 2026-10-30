import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'v_atraccion_completa',
  synchronize: false,
  expression:
    'SELECT a.atr_id, a.atr_nombre, a.atr_slug, a.atr_estado, a.atr_tipo,\n       a.ciu_id, o.ope_nombre AS operador, o.ope_ruc AS operador_ruc\nFROM atraccion a\nJOIN operador o ON o.ope_id = a.ope_id',
})
export class AtraccionCompletaView {
  @ViewColumn()
  atr_id!: string;

  @ViewColumn()
  atr_nombre!: string;

  @ViewColumn()
  atr_slug!: string;

  @ViewColumn()
  atr_estado!: string;

  @ViewColumn()
  atr_tipo!: string;

  @ViewColumn()
  ciu_id!: number;

  @ViewColumn()
  operador!: string;

  @ViewColumn()
  operador_ruc!: string | null;
}
