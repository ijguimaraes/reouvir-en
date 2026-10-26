import { useCallback } from "react";
import { Link } from "react-router-dom";
import type { CatalogDto, OfflineManifestDto } from "@reouvir/shared";
import { api } from "../api";
import { listManifests } from "../offline/download";
import { useLoad } from "../useLoad";

export function useCatalog() {
  return useLoad<CatalogDto>(useCallback(() => api.request<CatalogDto>("GET", "/catalog"), []));
}

export function useDownloads() {
  return useLoad<OfflineManifestDto[]>(listManifests);
}

export function Home() {
  const catalog = useCatalog();
  const downloads = useDownloads();

  const byCategory = new Map<string, CatalogDto["contexts"]>();
  for (const c of catalog.data?.contexts ?? []) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);

  return (
    <main>
      {downloads.data && downloads.data.length > 0 && (
        <>
          <h3>Baixadas (tocam offline)</h3>
          {downloads.data.map((m) => (
            <Link className="item" key={m.playlistId} to={`/p/${m.playlistId}`}>
              <span>{m.contextName} · {m.levelCode} · {m.topicName}</span>
              <span className="badge offline">offline</span>
            </Link>
          ))}
        </>
      )}
      <h2>O que você quer ouvir?</h2>
      {catalog.error && <p className="error">Sem conexão com o servidor. {downloads.data?.length ? "Suas playlists baixadas continuam disponíveis." : ""}</p>}
      {!catalog.data && !catalog.error && <p className="muted">Carregando…</p>}
      {catalog.data?.contexts.length === 0 && <p className="muted">Ainda não há playlists publicadas.</p>}
      {[...byCategory].map(([category, contexts]) => (
        <section key={category}>
          <h3>{category}</h3>
          {contexts.map((c) => (
            <Link className="item" key={c.id} to={`/c/${c.id}`}>
              <span>{c.name}</span>
              <span className="muted">{c.levels.reduce((n, l) => n + l.topics.length, 0)} playlists</span>
            </Link>
          ))}
        </section>
      ))}
    </main>
  );
}

export function ContextPage({ contextId }: { contextId: string }) {
  const catalog = useCatalog();
  const downloads = useDownloads();
  const ctx = catalog.data?.contexts.find((c) => c.id === contextId);
  const offline = new Set(downloads.data?.map((m) => m.playlistId));

  if (!catalog.data) return <main><p className={catalog.error ? "error" : "muted"}>{catalog.error || "Carregando…"}</p></main>;
  if (!ctx) return <main><p className="muted">Contexto não encontrado.</p></main>;
  return (
    <main>
      <h2>{ctx.name}</h2>
      {ctx.description && <p className="muted">{ctx.description}</p>}
      {ctx.levels.map((l, i) => (
        <details key={l.id} open={i === 0}>
          <summary>{l.name}</summary>
          {l.topics.map((t) => (
            <Link className="item" key={t.playlistId} to={`/p/${t.playlistId}`}>
              <span>{t.name}</span>
              <span className="row">
                <span className="muted">{t.sentenceCount}</span>
                {offline.has(t.playlistId) && <span className="badge offline">offline</span>}
              </span>
            </Link>
          ))}
        </details>
      ))}
    </main>
  );
}
