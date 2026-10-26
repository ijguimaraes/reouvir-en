import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { ROLES, type Role } from "@reouvir/shared";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AccessPayload {
  sub: string;
  role: Role;
}

export class TokenService {
  private key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  signAccess(payload: AccessPayload): Promise<string> {
    return new SignJWT({ role: payload.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.key);
  }

  /** Devolve o payload, ou null se o token for inválido ou estiver expirado. */
  async verifyAccess(token: string): Promise<AccessPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] });
      const role = payload.role as Role;
      if (!payload.sub || !ROLES.includes(role)) return null;
      return { sub: payload.sub, role };
    } catch {
      return null;
    }
  }
}

/** Token opaco: o valor vai para o cookie, só o hash vai para o banco. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
