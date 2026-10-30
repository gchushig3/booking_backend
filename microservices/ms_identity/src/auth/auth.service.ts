import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  UsuarioEntity,
  UsuarioRolEntity,
  RolEntity,
  SesionEntity,
  TokenVerificacionEntity,
} from '../database/entities/index.js';
import { AUTH_SETTINGS } from './auth.settings.js';
import type { AuthSettings } from './auth.settings.js';
import type { Principal } from './auth.decorators.js';
import type { RegisterDto, LoginDto } from './auth.dto.js';
import { IdentityJwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { IdentityMailService } from './mail.service.js';

export const tokenHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
const denied = () =>
  new UnauthorizedException('Invalid or expired credentials.');
const invalidToken = () =>
  new BadRequestException('Invalid or expired verification token.');
export function publicUser(user: UsuarioEntity, roles: string[]) {
  return {
    id: user.usu_id,
    email: user.usu_correo,
    first_name: user.usu_nombre,
    last_name: user.usu_apellido,
    document: user.usu_documento,
    phone: user.usu_telefono,
    birth_date: user.usu_fecha_nacimiento,
    avatar_url: user.usu_avatar,
    verified: user.usu_verificado,
    active: user.usu_activo,
    roles,
    last_login_at: user.usu_ultimo_acceso,
    created_at: user.usu_creado_en,
    updated_at: user.usu_actualizado_en,
  };
}
@Injectable()
export class AuthService {
  constructor(
    private readonly source: DataSource,
    private readonly jwt: IdentityJwtService,
    private readonly passwords: PasswordService,
    private readonly mail: IdentityMailService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}
  private async roles(
    manager: EntityManager,
    userId: string,
  ): Promise<string[]> {
    const rows = await manager
      .createQueryBuilder(UsuarioRolEntity, 'ur')
      .innerJoin(RolEntity, 'r', 'r.rol_id = ur.rol_id')
      .select('r.rol_nombre', 'name')
      .where('ur.usu_id = :userId AND r.rol_activo = true', { userId })
      .orderBy('r.rol_id')
      .getRawMany<{ name: string }>();
    return rows.map((row) => row.name);
  }
  private async lockUser(
    manager: EntityManager,
    userId: string,
    password = false,
  ): Promise<UsuarioEntity> {
    const query = manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .where('u.usu_id = :userId', { userId })
      .setLock('pessimistic_write');
    if (password) query.addSelect('u.usu_password');
    const user = await query.getOne();
    if (!user?.usu_activo) throw denied();
    return user;
  }
  private async verification(
    manager: EntityManager,
    userId: string,
    purpose: 'EMAIL' | 'RECUPERACION',
  ): Promise<string> {
    await manager.update(
      TokenVerificacionEntity,
      { usu_id: userId, tokv_tipo: purpose, tokv_usado: false },
      { tokv_usado: true },
    );
    const token = randomBytes(32).toString('base64url');
    await manager.insert(TokenVerificacionEntity, {
      usu_id: userId,
      tokv_tipo: purpose,
      tokv_token: tokenHash(token),
      tokv_expira_en: new Date(
        Date.now() + (purpose === 'EMAIL' ? 86400000 : 900000),
      ),
    });
    return token;
  }
  async register(dto: RegisterDto) {
    const password = await this.passwords.hash(dto.password);
    try {
      const result = await this.source.transaction(async (manager) => {
        // Serialize canonical email registration without changing the SQL domain or index.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [dto.email],
        );
        const existing = await manager
          .createQueryBuilder(UsuarioEntity, 'u')
          .where('lower(u.usu_correo) = :email', { email: dto.email })
          .getExists();
        if (existing) throw new ConflictException('Account already exists.');
        const role = await manager.findOneBy(RolEntity, {
          rol_nombre: 'CLIENTE',
          rol_activo: true,
        });
        if (!role) throw new ServiceUnavailableException();
        const user = await manager.save(
          UsuarioEntity,
          manager.create(UsuarioEntity, {
            usu_correo: dto.email,
            usu_password: password,
            usu_nombre: dto.first_name,
            usu_apellido: dto.last_name,
          }),
        );
        await manager.insert(UsuarioRolEntity, {
          usu_id: user.usu_id,
          rol_id: role.rol_id,
          usr_asignado_por: null,
        });
        const token = await this.verification(manager, user.usu_id, 'EMAIL');
        const saved = await manager.findOneByOrFail(UsuarioEntity, {
          usu_id: user.usu_id,
        });
        return { user: publicUser(saved, ['CLIENTE']), token };
      });
      const sent = await this.mail.send(dto.email, 'EMAIL', result.token);
      return { user: result.user, verification_email_sent: sent };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'driverError' in error &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('Account already exists.');
      throw error;
    }
  }
  async login(dto: LoginDto, metadata: { ip?: string; userAgent?: string }) {
    const snapshot = await this.source.manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .addSelect('u.usu_password')
      .where('lower(u.usu_correo) = :email', { email: dto.email })
      .getOne();
    const valid = await this.passwords.verify(
      dto.password,
      snapshot?.usu_password,
    );
    if (!valid || !snapshot?.usu_activo) throw denied();
    return this.source.transaction(async (manager) => {
      const user = await this.lockUser(manager, snapshot.usu_id, true);
      if (user.usu_password !== snapshot.usu_password) throw denied();
      const roles = await this.roles(manager, user.usu_id);
      if (!roles.length) throw denied();
      const sid = randomUUID();
      const expiration = new Date(
        Date.now() + this.settings.refreshSeconds * 1000,
      );
      const tokens = await this.jwt.issue(user.usu_id, sid, roles, expiration);
      await manager.insert(SesionEntity, {
        ses_id: sid,
        usu_id: user.usu_id,
        ses_token_hash: tokenHash(tokens.refresh_token),
        ses_expira_en: expiration,
        ses_ip: metadata.ip?.slice(0, 45) ?? null,
        ses_user_agent: metadata.userAgent?.slice(0, 255) ?? null,
      });
      await manager.update(
        UsuarioEntity,
        { usu_id: user.usu_id },
        { usu_ultimo_acceso: new Date() },
      );
      return tokens;
    });
  }
  async authenticate(token: string): Promise<Principal> {
    const claims = await this.jwt.verify(token, 'access');
    const session = await this.source.manager.findOneBy(SesionEntity, {
      ses_id: claims.sid,
      usu_id: claims.sub,
    });
    const user = await this.source.manager.findOneBy(UsuarioEntity, {
      usu_id: claims.sub,
      usu_activo: true,
    });
    if (
      !session ||
      session.ses_revocada ||
      session.ses_expira_en.getTime() <= Date.now() ||
      !user
    )
      throw denied();
    const roles = await this.roles(this.source.manager, user.usu_id);
    if (!roles.length)
      throw new ForbiddenException('No active role grants access.');
    return { userId: user.usu_id, sessionId: session.ses_id, roles };
  }
  async refresh(token: string) {
    const claims = await this.jwt.verify(token, 'refresh');
    const result = await this.source.transaction(async (manager) => {
      const user = await this.lockUser(manager, claims.sub);
      const session = await manager
        .createQueryBuilder(SesionEntity, 's')
        .addSelect('s.ses_token_hash')
        .where('s.ses_id = :sid AND s.usu_id = :id', {
          sid: claims.sid,
          id: claims.sub,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !session ||
        session.ses_revocada ||
        session.ses_expira_en.getTime() <= Date.now()
      )
        throw denied();
      if (
        !timingSafeEqual(
          Buffer.from(tokenHash(token)),
          Buffer.from(session.ses_token_hash),
        )
      ) {
        await manager.update(
          SesionEntity,
          { ses_id: session.ses_id },
          { ses_revocada: true },
        );
        return null; // Commit replay revocation before returning 401.
      }
      const roles = await this.roles(manager, user.usu_id);
      if (!roles.length) throw denied();
      const tokens = await this.jwt.issue(
        user.usu_id,
        session.ses_id,
        roles,
        session.ses_expira_en,
      );
      await manager.update(
        SesionEntity,
        { ses_id: session.ses_id },
        { ses_token_hash: tokenHash(tokens.refresh_token) },
      );
      return tokens;
    });
    if (!result) throw denied();
    return result;
  }
  async me(principal: Principal) {
    const user = await this.source.manager.findOneByOrFail(UsuarioEntity, {
      usu_id: principal.userId,
    });
    return {
      user: publicUser(
        user,
        await this.roles(this.source.manager, principal.userId),
      ),
      session_id: principal.sessionId,
    };
  }
  async logout(principal: Principal, all = false): Promise<void> {
    await this.source.transaction(async (manager) => {
      await this.lockUser(manager, principal.userId);
      await manager.update(
        SesionEntity,
        {
          usu_id: principal.userId,
          ...(all ? {} : { ses_id: principal.sessionId }),
        },
        { ses_revocada: true },
      );
    });
  }
  async sessions(principal: Principal) {
    const rows = await this.source.manager
      .createQueryBuilder(SesionEntity, 's')
      .where(
        's.usu_id = :id AND s.ses_revocada = false AND s.ses_expira_en > now()',
        { id: principal.userId },
      )
      .orderBy('s.ses_creado_en', 'DESC')
      .getMany();
    return rows.map((s) => ({
      id: s.ses_id,
      ip: s.ses_ip,
      user_agent: s.ses_user_agent,
      expires_at: s.ses_expira_en,
      created_at: s.ses_creado_en,
      current: s.ses_id === principal.sessionId,
    }));
  }
  async revokeSession(principal: Principal, id: string): Promise<void> {
    await this.source.transaction(async (manager) => {
      await this.lockUser(manager, principal.userId);
      const result = await manager.update(
        SesionEntity,
        { ses_id: id, usu_id: principal.userId },
        { ses_revocada: true },
      );
      if (!result.affected) throw new NotFoundException('Session not found.');
    });
  }
  async requestVerification(
    email: string,
    purpose: 'EMAIL' | 'RECUPERACION',
  ): Promise<{ message: string }> {
    const user = await this.source.manager
      .createQueryBuilder(UsuarioEntity, 'u')
      .where('lower(u.usu_correo) = :email', { email })
      .getOne();
    if (user?.usu_activo) {
      const token = await this.source.transaction(async (manager) => {
        const locked = await manager
          .createQueryBuilder(UsuarioEntity, 'u')
          .where('u.usu_id = :id', { id: user.usu_id })
          .setLock('pessimistic_write')
          .getOne();
        if (
          !locked?.usu_activo ||
          (purpose === 'EMAIL' && locked.usu_verificado)
        )
          return null;
        return this.verification(manager, user.usu_id, purpose);
      });
      if (token) await this.mail.send(user.usu_correo, purpose, token);
    }
    return { message: 'If the account is eligible, an email will be sent.' };
  }
  private async consume(
    token: string,
    purpose: 'EMAIL' | 'RECUPERACION',
    password?: string,
  ): Promise<void> {
    const hash = tokenHash(token);
    const snapshot = await this.source.manager
      .createQueryBuilder(TokenVerificacionEntity, 't')
      .where('t.tokv_token = :hash AND t.tokv_tipo = :purpose', {
        hash,
        purpose,
      })
      .getOne();
    if (!snapshot) throw invalidToken();
    await this.source.transaction(async (manager) => {
      const user = await manager
        .createQueryBuilder(UsuarioEntity, 'u')
        .where('u.usu_id = :id', { id: snapshot.usu_id })
        .setLock('pessimistic_write')
        .getOne();
      const record = await manager
        .createQueryBuilder(TokenVerificacionEntity, 't')
        .where('t.tokv_id = :id', { id: snapshot.tokv_id })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !user?.usu_activo ||
        !record ||
        record.tokv_usado ||
        record.tokv_expira_en.getTime() <= Date.now()
      )
        throw invalidToken();
      if (purpose === 'EMAIL') {
        await manager.update(
          UsuarioEntity,
          { usu_id: user.usu_id },
          { usu_verificado: true },
        );
        await manager.update(
          TokenVerificacionEntity,
          { usu_id: user.usu_id, tokv_tipo: 'EMAIL', tokv_usado: false },
          { tokv_usado: true },
        );
      } else {
        if (!password) throw invalidToken();
        await manager.update(
          UsuarioEntity,
          { usu_id: user.usu_id },
          { usu_password: password },
        );
        await this.revokeCredentials(manager, user.usu_id);
      }
    });
  }
  verifyEmail(token: string): Promise<void> {
    return this.consume(token, 'EMAIL');
  }
  async resetPassword(token: string, password: string): Promise<void> {
    await this.consume(
      token,
      'RECUPERACION',
      await this.passwords.hash(password),
    );
  }
  private async revokeCredentials(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await manager.update(
      SesionEntity,
      { usu_id: userId },
      { ses_revocada: true },
    );
    await manager.update(
      TokenVerificacionEntity,
      { usu_id: userId, tokv_tipo: 'RECUPERACION', tokv_usado: false },
      { tokv_usado: true },
    );
  }
  async changePassword(
    principal: Principal,
    current: string,
    next: string,
  ): Promise<void> {
    if (current === next)
      throw new BadRequestException('New password must differ.');
    const hash = await this.passwords.hash(next);
    await this.source.transaction(async (manager) => {
      const user = await this.lockUser(manager, principal.userId, true);
      if (!(await this.passwords.verify(current, user.usu_password)))
        throw denied();
      await manager.update(
        UsuarioEntity,
        { usu_id: user.usu_id },
        { usu_password: hash },
      );
      await this.revokeCredentials(manager, user.usu_id);
    });
  }
}
