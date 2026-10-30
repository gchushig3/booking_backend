import { CrearPagoRequestDto } from '../pago/dto/crear-pago-request.dto.js';
import { SimularPagoRequestDto } from '../pago/dto/simular-pago-request.dto.js';
import { JsonSchemaValidationPipe } from '@booking/infrastructure';
import type { ArgumentMetadata } from '@nestjs/common';

const create = new JsonSchemaValidationPipe({
  type: 'object',
  additionalProperties: false,
  required: ['numero', 'orden_id', 'metodo_codigo', 'monto'],
  properties: {
    numero: { type: 'string', minLength: 1, maxLength: 30 },
    orden_id: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
    metodo_codigo: { type: 'string', minLength: 1, maxLength: 20 },
    monto: {
      type: 'string',
      pattern: '^(?:0\\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,9}\\.[0-9]{2})$',
    },
  },
});
const simulate = new JsonSchemaValidationPipe({
  type: 'object',
  additionalProperties: false,
  required: ['resultado'],
  properties: {
    resultado: { enum: ['APROBADO', 'RECHAZADO', 'FALLIDO'] },
    motivo: { type: 'string', minLength: 1, maxLength: 300 },
  },
});
export const paymentSchemaPipe = {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === 'body') {
      if (metadata.metatype === CrearPagoRequestDto) create.transform(value);
      if (metadata.metatype === SimularPagoRequestDto)
        simulate.transform(value);
    }
    return value;
  },
};
