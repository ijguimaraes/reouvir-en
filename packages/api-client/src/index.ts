import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
} from "@reouvir/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "/api";
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let refreshing: Promise<boolean> | null = null;

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    return doFetch(baseUrl + path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Uma única renovação por vez, compartilhada entre requisições concorrentes. */
  function refreshOnce(): Promise<boolean> {
    refreshing ??= send("POST", "/auth/refresh")
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res = await send(method, path, body);
    // Ao receber 401, tenta renovar a sessão uma vez (exceto nas próprias rotas de auth).
    if (res.status === 401 && !path.startsWith("/auth/") && (await refreshOnce())) {
      res = await send(method, path, body);
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, data?.error?.message ?? res.statusText, data?.error?.code);
    }
    return data as T;
  }

  return {
    request,
    auth: {
      register: (input: RegisterInput) => request<AuthResponse>("POST", "/auth/register", input),
      login: (input: LoginInput) => request<AuthResponse>("POST", "/auth/login", input),
      logout: () => request<void>("POST", "/auth/logout"),
      logoutAll: () => request<void>("POST", "/auth/logout-all"),
      me: async (): Promise<PublicUser | null> => {
        try {
          return (await request<AuthResponse>("GET", "/auth/me")).user;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) return null;
          throw err;
        }
      },
      changePassword: (input: ChangePasswordInput) =>
        request<AuthResponse>("POST", "/auth/change-password", input),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
