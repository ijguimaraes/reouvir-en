import type { AdminUserDto } from "@reouvir/shared";
import type { Queryable } from "../../db/pool";
import type { UserRow } from "../auth/auth.repository";

export class UsersRepository {
  constructor(private db: Queryable) {}

  async list(): Promise<AdminUserDto[]> {
    const { rows } = await this.db.query<UserRow>("SELECT * FROM users ORDER BY created_at DESC");
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    }));
  }

  async setStatus(id: string, status: "active" | "blocked"): Promise<boolean> {
    const r = await this.db.query("UPDATE users SET status = $2 WHERE id = $1", [id, status]);
    return (r.rowCount ?? 0) > 0;
  }

  async setTemporaryPassword(id: string, passwordHash: string): Promise<boolean> {
    const r = await this.db.query(
      "UPDATE users SET password_hash = $2, must_change_password = true WHERE id = $1",
      [id, passwordHash],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async revokeAllTokens(id: string): Promise<void> {
    await this.db.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
  }
}
