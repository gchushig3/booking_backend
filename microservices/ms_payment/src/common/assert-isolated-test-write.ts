import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function assertIsolatedTestWrite(
  configService: ConfigService,
  nodeEnvironment = configService.getOrThrow<string>('NODE_ENV'),
): void {
  if (nodeEnvironment === 'test') {
    const isolatedTestDatabase =
      configService.getOrThrow<string>('DB_HOST') === '127.0.0.1' &&
      configService.getOrThrow<number>('DB_PORT') === 5434 &&
      configService.getOrThrow<string>('DB_DATABASE') === 'ms_payment_test';

    if (!isolatedTestDatabase) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ISOLATED_TEST_DATABASE_REQUIRED',
        message:
          'Payment write tests require the isolated PostgreSQL test database',
      });
    }
  }
}
