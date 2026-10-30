import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { AUTH_SETTINGS } from './auth.settings.js';
import type { AuthSettings } from './auth.settings.js';
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummy!: string;
  constructor(@Inject(AUTH_SETTINGS) private readonly settings: AuthSettings) {}
  async onModuleInit(): Promise<void> {
    this.dummy = await this.hash(randomBytes(24).toString('base64url'));
  }
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.settings.bcryptRounds);
  }
  async verify(password: string, hash?: string): Promise<boolean> {
    const valid = await bcrypt.compare(password, hash ?? this.dummy);
    return !!hash && valid;
  }
}
