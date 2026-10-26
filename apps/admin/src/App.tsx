import { useEffect, useState, type FormEvent } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import type { PublicUser } from "@reouvir/shared";
import { toggleTheme } from "@reouvir/shared/theme";
import { api } from "./api";
import { errMsg } from "./ui";
import { ContextsPage, LevelsPage, TopicsPage } from "./pages/Catalog";
import { DashboardPage } from "./pages/Dashboard";
import { ContextDetailPage } from "./pages/ContextDetail";
import { PlaylistDetailPage } from "./pages/Playlists";
import { UsersPage } from "./pages/Users";

function Login({ onUser }: { onUser: (u: PublicUser) => void }) {
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await api.auth.login({ email: String(f.get("email")), password: String(f.get("password")) });
      if (res.user.role !== "admin") {
        await api.auth.logout();
        setError("Acesso restrito a administradores");
        return;
      }
      onUser(res.user);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>Backoffice</h1>
      <p className="muted">Reouvir EN</p>
      <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
      <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit">Entrar</button>
    </form>
  );
}

const NAV: [string, string][] = [
  ["/", "Painel"],
  ["/contexts", "Contextos"],
  ["/levels", "Níveis"],
  ["/topics", "Tópicos"],
  ["/users", "Usuários"],
];

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me().then((u) => setUser(u?.role === "admin" ? u : null)).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) return <Login onUser={setUser} />;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div className="shell">
        <nav className="side">
          <h1>Reouvir EN</h1>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
          ))}
          <div className="spacer" />
          <span className="muted">{user.email}</span>
          <button onClick={() => toggleTheme()}>Alternar tema</button>
          <button onClick={async () => { await api.auth.logout(); setUser(null); }}>Sair</button>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/contexts/:id" element={<ContextDetailPage />} />
            <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="/levels" element={<LevelsPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/contexts" element={<ContextsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
