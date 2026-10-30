import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearPagoRequestDto } from './crear-pago-request.dto.js';
import { ListarPagosQueryDto } from './listar-pagos-query.dto.js';

describe('Payment request DTOs', () => {
  it.each(['0.00', '1', '1.000', '10000000000.00', 1.25])(
    'rejects invalid monetary value %s',
    async (monto) => {
      const dto = plainToInstance(CrearPagoRequestDto, {
        numero: 'PAY-DEMO-1',
        orden_id: '42',
        metodo_codigo: 'TARJETA',
        monto,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it.each(['0', '-1', '9223372036854775808', '01', 'not-an-id'])(
    'rejects invalid BIGINT id %s',
    async (orden_id) => {
      const dto = plainToInstance(CrearPagoRequestDto, {
        numero: 'PAY-DEMO-1',
        orden_id,
        metodo_codigo: 'TARJETA',
        monto: '1.00',
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('converts and validates documented list pagination defaults and limits', async () => {
    const dto = plainToInstance(ListarPagosQueryDto, {
      limit: '25',
      offset: '4',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.offset).toBe(4);
  });

  it.each([
    { limit: '0' },
    { limit: '101' },
    { offset: '-1' },
    { estado: 'UNKNOWN' },
    { metodo: 'PAYPAL' },
    { ord_id: '9223372036854775808' },
  ])('rejects invalid list query %#', async (query) => {
    const dto = plainToInstance(ListarPagosQueryDto, query);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
