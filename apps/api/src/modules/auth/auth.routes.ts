import type { FastifyInstance, FastifyReply } from "fastify";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "@reouvir/shared";
import type { Config } from "../../config";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.plugin";
import type { AuthService, Session } from "./auth.service";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from "./tokens";

const REFRESH_PATH = "/api/auth";

export interface AuthRoutesDeps {
  config: Config;
  service: AuthService;
  authenticate: (req: import("fastify").FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRoutesDeps): void {
  const { config, service, authenticate } = deps;

  const cookieBase = { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: "lax" as const };

  function setSession(reply: FastifyReply, s: Session): void {
    reply.setCookie(ACCESS_COOKIE, s.accessToken, {
      ...cookieBase,
      path: "/",
      maxAge: ACCESS_TTL_SECONDS,
    });
    reply.setCookie(REFRESH_COOKIE, s.refreshToken, {
      ...cookieBase,
      path: REFRESH_PATH,
      maxAge: REFRESH_TTL_SECONDS,
    });
  }

  function clearSession(reply: FastifyReply): void {
    reply.clearCookie(ACCESS_COOKIE, { ...cookieBase, path: "/" });
    reply.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: REFRESH_PATH });
  }

  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const session = await service.register(body, req.ip, req.headers["user-agent"] ?? null);
    setSession(reply, session);
    return reply.code(201).send({ user: session.user });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const session = await service.login(body, req.ip, req.headers["user-agent"] ?? null);
    setSession(reply, session);
    return { user: session.user };
  });

  app.post("/auth/refresh", async (req, reply) => {
    try {
      const session = await service.refresh(
        req.cookies[REFRESH_COOKIE],
        req.headers["user-agent"] ?? null,
      );
      setSession(reply, session);
      return { user: session.user };
    } catch (err) {
      clearSession(reply);
      throw err;
    }
  });

  app.post("/auth/logout", async (req, reply) => {
    await service.logout(req.cookies[REFRESH_COOKIE]);
    clearSession(reply);
    return reply.code(204).send();
  });

  app.post("/auth/logout-all", { preHandler: authenticate }, async (req, reply) => {
    await service.logoutAll(req.authUser!.id);
    clearSession(reply);
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: authenticate }, async (req) => {
    return { user: await service.me(req.authUser!.id) };
  });

  app.post("/auth/change-password", { preHandler: authenticate }, async (req) => {
    const body = changePasswordSchema.parse(req.body);
    const user = await service.changePassword(
      req.authUser!.id,
      req.cookies[REFRESH_COOKIE],
      body,
    );
    return { user };
  });
}
