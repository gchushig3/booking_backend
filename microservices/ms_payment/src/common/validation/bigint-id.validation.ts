import { registerDecorator, type ValidationOptions } from 'class-validator';

export const POSTGRES_BIGINT_ID_MAX = 9223372036854775807n;
const CANONICAL_BIGINT_ID = /^[1-9][0-9]{0,18}$/;

export function isBigIntId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    CANONICAL_BIGINT_ID.test(value) &&
    BigInt(value) <= POSTGRES_BIGINT_ID_MAX
  );
}

export function IsBigIntId(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isBigIntId',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: isBigIntId,
        defaultMessage: () =>
          `$property must be a canonical decimal string between 1 and ${POSTGRES_BIGINT_ID_MAX}`,
      },
    });
  };
}
