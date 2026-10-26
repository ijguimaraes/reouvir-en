import type { OfflineManifestDto } from "@reouvir/shared";
import { api } from "../api";
import { idb } from "./idb";

/** Mesmo nome usado pelo service worker (src/sw/sw.ts), que serve os arquivos deste cache. */
export const AUDIO_CACHE = "reouvir-audio-v1";
const PARALLEL = 4;

export const getManifest = (playlistId: string) => idb.get<OfflineManifestDto>("manifests", playlistId);
export const listManifests = () => idb.all<OfflineManifestDto>("manifests");

/** Baixa frases e MP3 da playlist. O manifesto só é gravado no fim: "baixada" é tudo ou nada. */
export async function downloadPlaylist(
  playlistId: string,
  onProgress: (done: number, total: number) => void,
): Promise<OfflineManifestDto> {
  const manifest = await api.request<OfflineManifestDto>("POST", `/playlists/${playlistId}/prepare`);
  const cache = await caches.open(AUDIO_CACHE);
  const total = manifest.sentences.length;
  let done = 0;
  let next = 0;
  onProgress(0, total);

  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, total) }, async () => {
      while (next < total) {
        const url = manifest.sentences[next++]!.audioUrl;
        if (!(await cache.match(url))) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Falha ao baixar o áudio (${res.status})`);
          await cache.put(url, res);
        }
        onProgress(++done, total);
      }
    }),
  );

  const previous = await getManifest(playlistId);
  await idb.put("manifests", manifest);
  if (previous) await pruneAudio(previous.sentences.map((s) => s.audioUrl));
  void navigator.storage?.persist?.();
  return manifest;
}

export async function removeDownload(playlistId: string): Promise<void> {
  const manifest = await getManifest(playlistId);
  await idb.del("manifests", playlistId);
  if (manifest) await pruneAudio(manifest.sentences.map((s) => s.audioUrl));
}

/** Remove do cache os áudios que nenhuma playlist baixada usa mais. */
async function pruneAudio(candidates: string[]): Promise<void> {
  const inUse = new Set((await listManifests()).flatMap((m) => m.sentences.map((s) => s.audioUrl)));
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(candidates.filter((u) => !inUse.has(u)).map((u) => cache.delete(u)));
}
