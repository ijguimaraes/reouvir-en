import { useState, type FormEvent } from "react";
import type { PublicUser } from "@reouvir/shared";
import { ApiError } from "@reouvir/api-client";
import { api } from "../api";

type Mode = "login" | "register";

export function Access({ onUser }: { onUser: (u: PublicUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    try {
      const res =
        mode === "login"
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password, name: String(f.get("name")) });
      onUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    }
  }

  return (
    <main className="auth">
      <h1>Reouvir EN</h1>
      <p className="muted">Hear it again.</p>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label>
            Nome
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Senha{mode === "register" && <span className="muted">Mínimo de 8 caracteres</span>}
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary big">{mode === "login" ? "Entrar" : "Criar conta"}</button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
      </form>
    </main>
  );
}

export function ChangePassword({ onDone }: { onDone: (u: PublicUser) => void }) {
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await api.auth.changePassword({
        currentPassword: String(f.get("current")),
        newPassword: String(f.get("next")),
      });
      onDone(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha de conexão");
    }
  }

  return (
    <main className="auth">
      <h1>Troque sua senha</h1>
      <p className="muted">Sua senha foi redefinida pelo administrador.</p>
      <form onSubmit={submit}>
        <label>
          Senha atual
          <input name="current" type="password" required autoComplete="current-password" />
        </label>
        <label>
          Nova senha
          <input name="next" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary big">Trocar senha</button>
      </form>
    </main>
  );
}

