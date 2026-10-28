import { api } from "../api";
import { idb } from "./idb";

export interface LocalState {
  playlistId: string;
  lastSentenceId: string | null;
  loopsCompleted: number;
  listenedSeconds: number;
  /** Audições por frase (id → vezes), total acumulado; o servidor guarda o maior. */
  listenCounts?: Record<string, number>;
  clientUpdatedAt: string;
  /** true enquanto o servidor ainda não recebeu esta versão. */
  pending: boolean;
}

export const getLocalState = (playlistId: string) => idb.get<LocalState>("state", playlistId);

async function push(s: LocalState): Promise<void> {
  const { pending: _pending, playlistId, ...body } = s;
  await api.request("PUT", `/playlists/${playlistId}/state`, body);
  // só limpa o "pendente" se nada mais novo foi gravado enquanto enviava
  const current = await getLocalState(playlistId);
  if (current && current.clientUpdatedAt === s.clientUpdatedAt) await idb.put("state", { ...current, pending: false });
}

/** Grava localmente a cada frase e tenta enviar; offline, fica pendente. */
export async function saveState(s: Omit<LocalState, "clientUpdatedAt" | "pending">): Promise<void> {
  const state: LocalState = { ...s, clientUpdatedAt: new Date().toISOString(), pending: true };
  await idb.put("state", state);
  if (navigator.onLine) await push(state).catch(() => undefined);
}

/** Envia tudo o que ficou pendente (evento `online` e abertura do app). */
export async function flushPending(): Promise<void> {
  if (!navigator.onLine) return;
  const all = await idb.all<LocalState>("state");
  for (const s of all.filter((x) => x.pending)) await push(s).catch(() => undefined);
}

export function startSync(): void {
  window.addEventListener("online", () => void flushPending());
  void flushPending();
}
