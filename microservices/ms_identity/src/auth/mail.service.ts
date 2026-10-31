import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { OnModuleDestroy } from '@nestjs/common';
import type { IdentityEnvironment } from '../config/environment.js';
@Injectable()
export class IdentityMailService implements OnModuleDestroy {
  private readonly transport?: Transporter;
  private readonly from?: string;
  readonly enabled: boolean;
  private readonly logger = new Logger(IdentityMailService.name);
  constructor(config: ConfigService) {
    const env = config.getOrThrow<IdentityEnvironment>('identity');
    this.enabled = env.SMTP_ENABLED;
    if (!this.enabled) return;
    this.from = env.SMTP_FROM;
    const secure = env.SMTP_PORT === 465;
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure,
      requireTLS: env.APP_ENV === 'production' && !secure,
      ignoreTLS: false,
      ...(env.SMTP_USER && env.SMTP_PASS
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  async send(
    email: string,
    purpose: 'EMAIL' | 'RECUPERACION',
    token: string,
  ): Promise<boolean> {
    if (!this.transport) return false;
    try {
      const result = await this.transport.sendMail({
        from: this.from,
        to: email,
        subject:
          purpose === 'EMAIL'
            ? 'Descubre EC - Email verification'
            : 'Descubre EC - Password recovery',
        text: `Purpose: ${purpose}\nToken: ${token}\nUse POST /api/v2/auth/${purpose === 'EMAIL' ? 'verify-email' : 'reset-password'} with this token. It is single-use and expires.`,
      });
      return (result.accepted?.length ?? 0) > 0;
    } catch {
      this.logger.warn({ code: 'LOCAL_MAIL_DELIVERY_FAILED' });
      return false;
    }
  }
  onModuleDestroy(): void {
    this.transport?.close();
  }
}
