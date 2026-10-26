import type { AudioInfoDto, OfflineManifestDto, StudentPlaylistDto } from "@reouvir/shared";
import { api } from "../api";
import type { ItemAudio } from "./engine";

export interface PlaybackSource {
  items: { id: string; text: string }[];
  resolve(index: number): Promise<ItemAudio>;
  /** Garante os áudios das próximas frases (janela de prefetch). */
  prefetch(fromIndex: number): void;
}

export const PREFETCH_AHEAD = 3;

/** Playlist baixada: tudo vem do manifesto local, sem chamar o back-end. */
export function offlineSource(m: OfflineManifestDto): PlaybackSource {
  return {
    items: m.sentences.map((s) => ({ id: s.id, text: s.text })),
    resolve: async (i) => ({ url: m.sentences[i]!.audioUrl, durationMs: m.sentences[i]!.durationMs }),
    prefetch: () => undefined,
  };
}

/** Playlist online: pede o áudio de cada frase (lazy no servidor) e antecipa as próximas. */
export function onlineSource(p: StudentPlaylistDto): PlaybackSource {
  const memo = new Map<number, Promise<ItemAudio>>();
  const resolve = (i: number): Promise<ItemAudio> => {
    let pr = memo.get(i);
    if (!pr) {
      const s = p.sentences[i]!;
      pr = s.audioUrl && s.durationMs
        ? Promise.resolve({ url: s.audioUrl, durationMs: s.durationMs })
        : api.request<AudioInfoDto>("GET", `/sentences/${s.id}/audio`);
      memo.set(i, pr);
      pr.catch(() => memo.delete(i)); // permite nova tentativa
    }
    return pr;
  };
  return {
    items: p.sentences.map((s) => ({ id: s.id, text: s.text })),
    resolve,
    prefetch: (from) => {
      for (let k = 1; k <= PREFETCH_AHEAD && from + k < p.sentences.length; k++) resolve(from + k).catch(() => undefined);
    },
  };
}
