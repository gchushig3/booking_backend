import { Module } from '@nestjs/common';
import { BookingApiKeyGuard, JsonSchemaModule } from '@booking/infrastructure';
import { BookingConsumerController } from './booking-consumer.controller.js';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_SETTINGS, authSettings } from './auth.settings.js';
import { AuthController, JwksController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessGuard, AuthRateGuard, RolesGuard } from './auth.guards.js';
import { IdentityJwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { IdentityMailService } from './mail.service.js';
@Module({
  imports: [JsonSchemaModule],
  controllers: [AuthController, JwksController, BookingConsumerController],
  providers: [
    {
      provide: AUTH_SETTINGS,
      inject: [ConfigService],
      useFactory: authSettings,
    },
    AuthService,
    IdentityJwtService,
    PasswordService,
    IdentityMailService,
    BookingApiKeyGuard,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AuthRateGuard },
  ],
  exports: [AuthService, IdentityJwtService],
})
export class AuthModule {}
