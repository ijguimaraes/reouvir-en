import { describe, expect, it } from "vitest";
import { createAdminSession } from "./session";

function fakeApi() {
  const seen: { path: string; cookie: string | null }[] = [];
  let logins = 0;
  const fetchFn: typeof fetch = async (input, init) => {
    const path = String(input).replace("http://api", "");
    const cookie = new Headers(init?.headers).get("cookie");
    seen.push({ path, cookie });
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
    if (path === "/auth/login") {
      logins++;
      const h = new Headers();
      h.append("set-cookie", `access_token=a${logins}; Path=/; HttpOnly`);
      h.append("set-cookie", `refresh_token=r${logins}; Path=/api/auth; HttpOnly`);
      return new Response(JSON.stringify({ user: {} }), { status: 200, headers: h });
    }
    if (path === "/auth/refresh") return json(401, { error: { message: "expirou", code: "unauthorized" } });
    return cookie?.includes("access_token=a2") ? json(200, { ok: true }) : json(401, { error: { message: "x" } });
  };
  return { fetchFn, seen };
}

describe("createAdminSession", () => {
  it("envia os cookies e entra de novo quando o refresh falha", async () => {
    const { fetchFn, seen } = fakeApi();
    const api = createAdminSession({ baseUrl: "http://api/", email: "a@b.c", password: "x" }, fetchFn);
    await api.login();
    const res = await api.request<{ ok: boolean }>("GET", "/admin/contexts");
    expect(res.ok).toBe(true);
    const last = seen[seen.length - 1];
    expect(last.path).toBe("/admin/contexts");
    expect(last.cookie).toContain("access_token=a2");
  });
});
