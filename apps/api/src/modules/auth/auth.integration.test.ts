import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app";
import { createPool } from "../../db/pool";
import { testConfig } from "../../test-utils";

// Roda contra um Postgres real (já migrado). Sem DATABASE_URL_TEST, o arquivo é ignorado.
const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("auth (integração)", () => {
  const pool = createPool(url ?? "postgres://invalid");
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      config: testConfig(url!),
      pool,
    });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE users CASCADE");
  });

  const cookiesOf = (res: { cookies: { name: string; value: string }[] }) =>
    Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));

  async function register(email = "aluno@example.com") {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "senha-boa-123", name: "Aluno" },
    });
    return { res, cookies: cookiesOf(res) };
  }

  it("cadastra, abre sessão e responde /me", async () => {
    const { res, cookies } = await register();
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe("student");
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { access_token: cookies.access_token! },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("aluno@example.com");
  });

  it("recusa e-mail repetido sem diferenciar maiúsculas", async () => {
    await register("aluno@example.com");
    const again = await register("ALUNO@example.com");
    expect(again.res.statusCode).toBe(409);
  });

  it("login com senha errada devolve mensagem genérica", async () => {
    await register();
    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "aluno@example.com", password: "errada-errada" },
    });
    const missing = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "nao@existe.com", password: "errada-errada" },
    });
    expect(bad.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(bad.json().error.message).toBe(missing.json().error.message);
  });

  it("rotaciona o refresh token e revoga a família no reuso", async () => {
    const { cookies } = await register();
    const first = cookies.refresh_token!;
    const r1 = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: first },
    });
    expect(r1.statusCode).toBe(200);
    const second = cookiesOf(r1).refresh_token!;
    expect(second).not.toBe(first);

    // reapresentar o token antigo derruba a família inteira
    const reuse = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: first },
    });
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: second },
    });
    expect(afterReuse.statusCode).toBe(401);
  });

  it("usuário bloqueado não renova a sessão", async () => {
    const { cookies } = await register();
    await pool.query("UPDATE users SET status = 'blocked'");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(res.statusCode).toBe(401);
  });

  it("troca a senha e revoga as outras sessões", async () => {
    const { cookies: a } = await register();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "aluno@example.com", password: "senha-boa-123" },
    });
    const b = cookiesOf(login);

    const change = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { access_token: a.access_token!, refresh_token: a.refresh_token! },
      payload: { currentPassword: "senha-boa-123", newPassword: "outra-senha-456" },
    });
    expect(change.statusCode).toBe(200);

    const otherSession = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: b.refresh_token! },
    });
    expect(otherSession.statusCode).toBe(401);
    const currentSession = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: a.refresh_token! },
    });
    expect(currentSession.statusCode).toBe(200);
  });

  it("rotas protegidas exigem autenticação", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});
