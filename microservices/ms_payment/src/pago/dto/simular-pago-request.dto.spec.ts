import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SimularPagoRequestDto } from './simular-pago-request.dto.js';

describe('SimularPagoRequestDto', () => {
  it('accepts APROBADO without a motivo', async () => {
    const dto = plainToInstance(SimularPagoRequestDto, {
      resultado: 'APROBADO',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['RECHAZADO', 'FALLIDO'] as const)(
    'requires a nonblank motivo for %s',
    async (resultado) => {
      const missing = plainToInstance(SimularPagoRequestDto, { resultado });
      const blank = plainToInstance(SimularPagoRequestDto, {
        resultado,
        motivo: '   ',
      });
      const valid = plainToInstance(SimularPagoRequestDto, {
        resultado,
        motivo: 'Resultado simulado',
      });

      expect(await validate(missing)).not.toHaveLength(0);
      expect(await validate(blank)).not.toHaveLength(0);
      expect(await validate(valid)).toHaveLength(0);
    },
  );

  it.each([
    { resultado: 'PENDIENTE' },
    { resultado: 'UNKNOWN' },
    { resultado: 'APROBADO', motivo: 'No permitido en este resultado' },
    { resultado: 'FALLIDO', motivo: 'x'.repeat(301) },
  ])('rejects invalid simulation body %#', async (body) => {
    const dto = plainToInstance(SimularPagoRequestDto, body);
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
