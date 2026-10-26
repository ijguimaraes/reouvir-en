import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { PublicUser } from "@reouvir/shared";
import { api } from "./api";
import { Header } from "./components/Header";
import { startSync } from "./offline/sync";
import { Access, ChangePassword } from "./routes/Access";
import { ContextPage, Home } from "./routes/Home";
import { PlaylistPage } from "./routes/PlaylistPage";

const Context = () => <ContextPage contextId={useParams().id ?? ""} />;
const Playlist = () => {
  const id = useParams().id ?? "";
  return <PlaylistPage key={id} playlistId={id} />;
};

function Shell({ onLogout }: { onLogout: () => void }) {
  const loc = useLocation();
  return (
    <>
      <Header onLogout={onLogout} back={loc.pathname === "/" ? undefined : "/"} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/c/:id" element={<Context />} />
        <Route path="/p/:id" element={<Playlist />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

const USER_KEY = "reouvir-user";

function rememberUser(u: PublicUser | null): void {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* sem armazenamento: só perde a abertura offline */
  }
}

function lastKnownUser(): PublicUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function App() {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const setUser = (u: PublicUser | null) => {
    rememberUser(u);
    setUserState(u);
  };

  useEffect(() => {
    startSync();
    api.auth
      .me()
      .then((u) => setUser(u))
      // `me()` devolve null num 401 de verdade. Qualquer outra falha (sem rede, servidor fora)
      // não encerra a sessão: o app abre para tocar as playlists baixadas.
      .catch(() => setUserState(lastKnownUser()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) return <Access onUser={setUser} />;
  if (user.mustChangePassword) return <ChangePassword onDone={setUser} />;
  return (
    <BrowserRouter>
      <Shell onLogout={async () => { await api.auth.logout().catch(() => undefined); setUser(null); }} />
    </BrowserRouter>
  );
}
