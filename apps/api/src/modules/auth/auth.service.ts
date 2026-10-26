import argon2 from "argon2";
import type { Pool } from "pg";
import type { ChangePasswordInput, LoginInput, PublicUser, RegisterInput } from "@reouvir/shared";
import { withTransaction } from "../../db/pool";
import { AppError } from "../../errors";
import { AuthRepository, type UserRow } from "./auth.repository";
import { RateLimiter } from "./rate-limiter";
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TTL_SECONDS,
  TokenService,
} from "./tokens";

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const INVALID_CREDENTIALS = "E-mail ou senha inválidos";
const INVALID_SESSION = "Sessão inválida";
const WINDOW_MS = 15 * 60 * 1000;

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    mustChangePassword: u.must_change_password,
  };
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export class AuthService {
  private loginByIp: RateLimiter;
  private loginByEmail: RateLimiter;
  private registerByIp: RateLimiter;
  /** Hash de uma senha descartável, usado para gastar o mesmo tempo quando o e-mail não existe. */
  private dummyHash: Promise<string> = hashPassword("senha-descartavel-para-timing");

  constructor(
    private pool: Pool,
    private tokens: TokenService,
    limits: { loginPerIp: number; loginPerEmail: number; registerPerIp: number } = {
      loginPerIp: 30,
      loginPerEmail: 8,
      registerPerIp: 10,
    },
  ) {
    this.loginByIp = new RateLimiter(limits.loginPerIp, WINDOW_MS);
    this.loginByEmail = new RateLimiter(limits.loginPerEmail, WINDOW_MS);
    this.registerByIp = new RateLimiter(limits.registerPerIp, 60 * 60 * 1000);
  }

  private repo(db: Pool | import("pg").PoolClient = this.pool): AuthRepository {
    return new AuthRepository(db);
  }

  private async openSession(
    repo: AuthRepository,
    user: UserRow,
    userAgent: string | null,
    familyId: string | null = null,
  ): Promise<{ session: Session; tokenId: string; familyId: string }> {
    const refresh = generateRefreshToken();
    const row = await repo.insertRefreshToken({
      userId: user.id,
      tokenHash: refresh.hash,
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      userAgent,
    });
    const accessToken = await this.tokens.signAccess({ sub: user.id, role: user.role });
    return {
      session: { user: toPublicUser(user), accessToken, refreshToken: refresh.token },
      tokenId: row.id,
      familyId: row.family_id,
    };
  }

  async register(input: RegisterInput, ip: string, userAgent: string | null): Promise<Session> {
    if (!this.registerByIp.hit(ip)) {
      throw new AppError(429, "Muitas tentativas. Tente novamente mais tarde.", "rate_limited");
    }
    const passwordHash = await hashPassword(input.password);
    return withTransaction(this.pool, async (client) => {
      const repo = this.repo(client);
      const user = await repo.createUser({
        email: input.email,
        name: input.name,
        passwordHash,
        role: "student",
      });
      if (!user) throw new AppError(409, "E-mail já cadastrado", "email_taken");
      await repo.touchLastLogin(user.id);
      return (await this.openSession(repo, user, userAgent)).session;
    });
  }

  async login(input: LoginInput, ip: string, userAgent: string | null): Promise<Session> {
    if (!this.loginByIp.hit(ip) || !this.loginByEmail.hit(input.email)) {
      throw new AppError(429, "Muitas tentativas. Tente novamente mais tarde.", "rate_limited");
    }
    const repo = this.repo();
    const user = await repo.findUserByEmail(input.email);
    if (!user) {
      await argon2.verify(await this.dummyHash, input.password).catch(() => false);
      throw new AppError(401, INVALID_CREDENTIALS, "invalid_credentials");
    }
    const ok = await argon2.verify(user.password_hash, input.password).catch(() => false);
    if (!ok) throw new AppError(401, INVALID_CREDENTIALS, "invalid_credentials");
    if (user.status === "blocked") throw new AppError(403, "Conta bloqueada", "blocked");

    this.loginByEmail.reset(input.email);
    await repo.touchLastLogin(user.id);
    return (await this.openSession(repo, user, userAgent)).session;
  }

  /** Rotaciona o refresh token. Reuso de um token já trocado revoga a família inteira. */
  async refresh(token: string | undefined, userAgent: string | null): Promise<Session> {
    if (!token) throw new AppError(401, INVALID_SESSION, "invalid_session");
    const hash = hashRefreshToken(token);

    // A revogação da família precisa persistir mesmo quando a requisição falha,
    // então ela roda fora da transação principal.
    const outcome = await withTransaction(this.pool, async (client) => {
      const repo = this.repo(client);
      const row = await repo.findRefreshTokenForUpdate(hash);
      if (!row) return { kind: "invalid" as const };
      if (row.revoked_at) return { kind: "reuse" as const, familyId: row.family_id };
      if (row.expires_at.getTime() <= Date.now()) return { kind: "invalid" as const };

      const user = await repo.findUserById(row.user_id);
      if (!user || user.status === "blocked") {
        await repo.revokeAllForUser(row.user_id);
        return { kind: "invalid" as const };
      }
      const next = await this.openSession(repo, user, userAgent, row.family_id);
      await repo.markRotated(row.id, next.tokenId);
      return { kind: "ok" as const, session: next.session };
    });

    if (outcome.kind === "ok") return outcome.session;
    if (outcome.kind === "reuse") await this.repo().revokeFamily(outcome.familyId);
    throw new AppError(401, INVALID_SESSION, "invalid_session");
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const repo = this.repo();
    const row = await repo.findRefreshToken(hashRefreshToken(token));
    if (row) await repo.revokeFamily(row.family_id);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repo().revokeAllForUser(userId);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repo().findUserById(userId);
    if (!user || user.status === "blocked") throw new AppError(401, INVALID_SESSION, "invalid_session");
    return toPublicUser(user);
  }

  /** Troca a senha, revoga as outras sessões e mantém a atual (nova família não é necessária). */
  async changePassword(
    userId: string,
    currentRefreshToken: string | undefined,
    input: ChangePasswordInput,
  ): Promise<PublicUser> {
    const repo = this.repo();
    const user = await repo.findUserById(userId);
    if (!user || user.status === "blocked") throw new AppError(401, INVALID_SESSION, "invalid_session");

    const ok = await argon2.verify(user.password_hash, input.currentPassword).catch(() => false);
    if (!ok) throw new AppError(400, "Senha atual incorreta", "wrong_password");

    const newHash = await hashPassword(input.newPassword);
    await withTransaction(this.pool, async (client) => {
      const txRepo = this.repo(client);
      await txRepo.updatePassword(userId, newHash);
      const current = currentRefreshToken
        ? await txRepo.findRefreshToken(hashRefreshToken(currentRefreshToken))
        : null;
      const keepFamily = current && current.user_id === userId && !current.revoked_at
        ? current.family_id
        : undefined;
      await txRepo.revokeAllForUser(userId, keepFamily);
    });
    return toPublicUser({ ...user, must_change_password: false });
  }
}
