import { useCallback, useEffect, useMemo, useState } from "react";
import type { OfflineManifestDto, PlayerSettings, StudentPlaylistDto } from "@reouvir/shared";
import { api } from "../api";
import { downloadPlaylist, getManifest, removeDownload } from "../offline/download";
import { manifestTitle } from "../offline/title";
import { cachedSettings, loadSettings } from "../offline/settings";
import { getLocalState } from "../offline/sync";
import { offlineSource, onlineSource } from "../player/source";
import { Player, type PlayerInit } from "../components/Player";

interface Loaded {
  title: { context: string; title: string; description: string };
  manifest: OfflineManifestDto | undefined;
  online: StudentPlaylistDto | null;
  init: Omit<PlayerInit, "settings">;
  settings: PlayerSettings;
}

export function PlaylistPage({ playlistId }: { playlistId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const manifest = await getManifest(playlistId);
      // offline-first: o manifesto local basta para tocar; o servidor só confirma versão e progresso
      const online = await api.request<StudentPlaylistDto>("GET", `/playlists/${playlistId}`).catch(() => null);
      if (!manifest && !online) throw new Error("Sem conexão. Baixe a playlist antes para ouvi-la offline.");

      const source = manifest ? offlineSource(manifest) : onlineSource(online!);
      const local = await getLocalState(playlistId);
      const server = online?.state ?? null;
      // vale o estado mais recente entre este aparelho e o servidor
      const useLocal = local && (!server || local.clientUpdatedAt >= server.clientUpdatedAt);
      const state = useLocal ? local : server;
      const idx = state?.lastSentenceId ? source.items.findIndex((s) => s.id === state.lastSentenceId) : 0;
      const settings = (await Promise.race([loadSettings(), new Promise<PlayerSettings>((r) => setTimeout(() => r(cachedSettings()), 2500))]));
      if (!alive) return;
      const t = manifest ?? online!;
      // online, o título é o atual do servidor (uma renomeação não sobe a versão do download)
      const playlistTitle = online?.title ?? manifestTitle(manifest!);
      setLoaded({
        title: { context: t.contextName, title: playlistTitle, description: online?.description ?? manifest?.description ?? "" },
        manifest,
        online,
        settings,
        init: {
          playlistId,
          source,
          startIndex: Math.max(idx, 0),
          baseLoops: state?.loopsCompleted ?? 0,
          baseListenedSeconds: state?.listenedSeconds ?? 0,
          title: playlistTitle,
          context: t.contextName,
        },
      });
    })().catch((e) => alive && setError(e instanceof Error ? e.message : "Falha ao abrir a playlist"));
    return () => {
      alive = false;
    };
  }, [playlistId, rev]);

  const updateAvailable = useMemo(
    () => !!loaded?.manifest && !!loaded.online && loaded.online.version !== loaded.manifest.version,
    [loaded],
  );

  const download = useCallback(async () => {
    setDownloadError("");
    setProgress([0, 1]);
    try {
      await downloadPlaylist(playlistId, (d, t) => setProgress([d, t]));
      setRev((r) => r + 1);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Falha no download");
    } finally {
      setProgress(null);
    }
  }, [playlistId]);

  if (error) return <main><p className="error">{error}</p></main>;
  if (!loaded) return <main><p className="muted">Carregando…</p></main>;

  const { title, manifest, online } = loaded;
  return (
    <main>
      <h2>{title.title}</h2>
      <p className="muted">{title.context}</p>
      {title.description && <p className="muted">{title.description}</p>}

      <div className="card">
        <span>
          {manifest ? <span className="badge offline">disponível offline</span> : <span className="muted">Só online</span>}
          {updateAvailable && <span className="muted"> · há versão nova</span>}
        </span>
        <span className="row">
          {online && (!manifest || updateAvailable) && !progress && (
            <button onClick={download}>{manifest ? "Atualizar download" : "Baixar playlist"}</button>
          )}
          {manifest && !progress && (
            <button className="link" onClick={async () => { await removeDownload(playlistId); setRev((r) => r + 1); }}>Remover</button>
          )}
        </span>
      </div>
      {progress && (
        <>
          <div className="bar"><i style={{ width: `${(progress[0] / progress[1]) * 100}%` }} /></div>
          <p className="muted">Baixando {progress[0]} de {progress[1]}… (os áudios novos são gerados agora)</p>
        </>
      )}
      {downloadError && <p className="error">{downloadError}</p>}

      <Player key={`${playlistId}:${manifest?.version ?? "online"}`} init={{ ...loaded.init, settings: loaded.settings }} />
    </main>
  );
}
