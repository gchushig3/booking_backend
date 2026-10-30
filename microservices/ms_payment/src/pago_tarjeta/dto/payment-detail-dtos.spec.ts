import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearDetalleTarjetaRequestDto } from './crear-detalle-tarjeta-request.dto.js';
import { CrearDetalleTransferenciaRequestDto } from '../../pago_transferencia/dto/crear-detalle-transferencia-request.dto.js';

describe('Payment detail request DTOs', () => {
  it.each([
    { ultimos4: '123' },
    { mes: 0 },
    { mes: 13 },
    { anio: 2019 },
    { anio: 2101 },
    { pais: 'ec' },
    { titular: 'x'.repeat(121) },
  ])('rejects invalid card detail %#', async (override) => {
    const dto = plainToInstance(CrearDetalleTarjetaRequestDto, {
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
      ...override,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('accepts valid card detail metadata', async () => {
    const dto = plainToInstance(CrearDetalleTarjetaRequestDto, {
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['2026-02-30', '27-10-2026', '2026-10-27T00:00:00Z'])(
    'rejects invalid transfer date %s',
    async (fecha_transferencia) => {
      const dto = plainToInstance(CrearDetalleTransferenciaRequestDto, {
        banco: 'Banco de prueba',
        numero_comprobante: 'COMPROBANTE-TEST-1',
        fecha_transferencia,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('accepts valid transfer metadata and a nullable attachment', async () => {
    const dto = plainToInstance(CrearDetalleTransferenciaRequestDto, {
      banco: 'Banco de prueba',
      numero_comprobante: 'COMPROBANTE-TEST-1',
      fecha_transferencia: '2026-10-27',
      archivo_adjunto: null,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
