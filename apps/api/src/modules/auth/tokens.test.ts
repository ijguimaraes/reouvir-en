import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashRefreshToken, TokenService } from "./tokens";

describe("TokenService", () => {
  const svc = new TokenService("segredo-de-teste-com-mais-de-32-caracteres!!");

  it("assina e verifica o access token", async () => {
    const token = await svc.signAccess({ sub: "u1", role: "admin" });
    expect(await svc.verifyAccess(token)).toEqual({ sub: "u1", role: "admin" });
  });

  it("rejeita token adulterado ou de outro segredo", async () => {
    const token = await svc.signAccess({ sub: "u1", role: "student" });
    expect(await svc.verifyAccess(token + "x")).toBeNull();
    const other = new TokenService("outro-segredo-de-teste-com-32-caracteres!");
    expect(await other.verifyAccess(token)).toBeNull();
  });
});

describe("refresh token", () => {
  it("gera valores únicos e o hash é determinístico", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(hashRefreshToken(a.token)).toBe(a.hash);
  });
});
