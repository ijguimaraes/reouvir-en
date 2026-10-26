import type { Role } from "@reouvir/shared";
import type { Queryable } from "../../db/pool";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  status: "active" | "blocked";
  must_change_password: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
  user_agent: string | null;
  created_at: Date;
}

export class AuthRepository {
  constructor(private db: Queryable) {}

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      "SELECT * FROM users WHERE lower(email) = lower($1)",
      [email],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ?? null;
  }

  /** Devolve null se o e-mail já existir (violação do índice único). */
  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
    mustChangePassword?: boolean;
  }): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (email, name, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [input.email, input.name, input.passwordHash, input.role, input.mustChangePassword ?? false],
    );
    return rows[0] ?? null;
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.query(
      "UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1",
      [userId, passwordHash],
    );
  }

  async insertRefreshToken(input: {
    userId: string;
    tokenHash: string;
    familyId: string | null;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<RefreshTokenRow> {
    const { rows } = await this.db.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent)
       VALUES ($1, $2, COALESCE($3::uuid, gen_random_uuid()), $4, $5)
       RETURNING *`,
      [input.userId, input.tokenHash, input.familyId, input.expiresAt, input.userAgent],
    );
    return rows[0]!;
  }

  /** Trava a linha para que dois refresh simultâneos do mesmo token não passem juntos. */
  async findRefreshTokenForUpdate(tokenHash: string): Promise<RefreshTokenRow | null> {
    const { rows } = await this.db.query<RefreshTokenRow>(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE",
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const { rows } = await this.db.query<RefreshTokenRow>(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1",
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async markRotated(id: string, replacedBy: string): Promise<void> {
    await this.db.query(
      "UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1",
      [id, replacedBy],
    );
  }

  async revokeToken(id: string): Promise<void> {
    await this.db.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
      [id],
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL",
      [familyId],
    );
  }

  async revokeAllForUser(userId: string, exceptFamilyId?: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL
         AND ($2::uuid IS NULL OR family_id <> $2::uuid)`,
      [userId, exceptFamilyId ?? null],
    );
  }
}
