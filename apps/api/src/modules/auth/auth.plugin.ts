import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@reouvir/shared";
import { AppError } from "../../errors";
import type { TokenService } from "./tokens";

export interface AuthUser {
  id: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function createAuthenticate(tokens: TokenService) {
  return async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const raw = req.cookies[ACCESS_COOKIE];
    const payload = raw ? await tokens.verifyAccess(raw) : null;
    if (!payload) throw new AppError(401, "Não autenticado", "unauthenticated");
    req.authUser = { id: payload.sub, role: payload.role };
  };
}

export function requireRole(role: Role) {
  return async function check(req: FastifyRequest): Promise<void> {
    if (req.authUser?.role !== role) throw new AppError(403, "Acesso negado", "forbidden");
  };
}
