import { ApiError, createApiClient, type ApiClient } from "@reouvir/api-client";

/** Guarda os cookies da API: o servidor só aceita sessão por cookie httpOnly, não por Bearer. */
export function createCookieFetch(base: typeof fetch = fetch): typeof fetch {
  const jar = new Map<string, string>();

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (jar.size > 0) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));

    const res = await base(input, { ...init, headers });

    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a));
      if (value === "" || expired) jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  };
}

export interface Credentials {
  baseUrl: string;
  email: string;
  password: string;
}

/**
 * Cliente autenticado como administrador. O api-client já renova o access token (15 min)
 * em 401; se o refresh também falhar, entra de novo com e-mail e senha e repete a chamada.
 */
export function createAdminSession(creds: Credentials, base: typeof fetch = fetch) {
  const client: ApiClient = createApiClient({ baseUrl: creds.baseUrl.replace(/\/+$/, ""), fetch: createCookieFetch(base) });
  let loggingIn: Promise<void> | null = null;

  function login(): Promise<void> {
    loggingIn ??= client.auth
      .login({ email: creds.email, password: creds.password })
      .then(() => undefined)
      .finally(() => {
        loggingIn = null;
      });
    return loggingIn;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      return await client.request<T>(method, path, body);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
      await login();
      return client.request<T>(method, path, body);
    }
  }

  return { request, login };
}
export type AdminSession = ReturnType<typeof createAdminSession>;
