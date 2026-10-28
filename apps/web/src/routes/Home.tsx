import { useCallback } from "react";
import { Link } from "react-router-dom";
import type { CatalogDto, OfflineManifestDto } from "@reouvir/shared";
import { api } from "../api";
import { listManifests } from "../offline/download";
import { manifestTitle } from "../offline/title";
import { RetryError, SkeletonList } from "../components/Skeleton";
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
          <h2 className="section-title">Baixadas (tocam offline)</h2>
          {downloads.data.map((m) => (
            <Link className="item" key={m.playlistId} to={`/p/${m.playlistId}`}>
              <span>{m.contextName} · {manifestTitle(m)}</span>
              <span className="badge offline">offline</span>
            </Link>
          ))}
        </>
      )}
      <h2>O que você quer ouvir?</h2>
      {catalog.error && (
        <RetryError
          message={`Sem conexão com o servidor. ${downloads.data?.length ? "Suas playlists baixadas continuam disponíveis." : "Conecte-se para ver as playlists."}`}
          onRetry={catalog.reload}
        />
      )}
      {!catalog.data && !catalog.error && <SkeletonList />}
      {catalog.data?.contexts.length === 0 && <p className="muted">Ainda não há playlists publicadas. Volte em breve.</p>}
      {[...byCategory].map(([category, contexts]) => (
        <section key={category}>
          <h3 className="section-title">{category}</h3>
          {contexts.map((c) => (
            <Link className="item" key={c.id} to={`/c/${c.id}`}>
              <span>{c.name}</span>
              <span className="muted num">{c.playlists.length} playlists</span>
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

  if (!catalog.data) {
    return <main>{catalog.error ? <RetryError message={catalog.error} onRetry={catalog.reload} /> : <SkeletonList />}</main>;
  }
  if (!ctx) return <main><p className="muted">Este contexto não existe mais. Volte ao início para escolher outro.</p></main>;
  return (
    <main>
      <h2>{ctx.name}</h2>
      {ctx.description && <p className="muted">{ctx.description}</p>}
      {ctx.playlists.map((pl) => (
        <Link className="item" key={pl.id} to={`/p/${pl.id}`}>
          <span>
            {pl.title}
            {pl.description && <span className="item-desc">{pl.description}</span>}
          </span>
          <span className="row">
            <span className="muted num">{pl.sentenceCount} frases</span>
            {offline.has(pl.id) && <span className="badge offline">offline</span>}
          </span>
        </Link>
      ))}
    </main>
  );
}
