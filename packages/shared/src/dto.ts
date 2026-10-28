import type { PlaylistStatus } from "./catalog";
import type { Role } from "./constants";

export interface ContextDto {
  id: string; slug: string; name: string; description: string; category: string;
  /** Detalhamento interno (cenário, situações, objetivos): guia de como montar o contexto. Não aparece para o aluno. */
  details: string;
  active: boolean;
}

export interface AdminUserDto {
  id: string; email: string; name: string; role: Role; status: "active" | "blocked";
  createdAt: string; lastLoginAt: string | null;
}

export interface AdminPlaylistDto {
  id: string; status: PlaylistStatus; version: number;
  contextId: string; contextName: string;
  /** Nome livre da playlist, definido pelo administrador. */
  title: string;
  /** Identificador único dentro do contexto (usado pela gravação direta de frases). */
  slug: string;
  /** Texto curto exibido ao aluno. */
  description: string;
  /** Posição da playlist dentro do contexto (1 a n). */
  position: number;
  sentenceCount: number; audioReady: number;
}

export interface SentenceDto { id: string; position: number; text: string; translationPt: string | null; audioReady: boolean; metadata: Record<string, unknown> | null }

export interface AdminPlaylistDetailDto extends AdminPlaylistDto { sentences: SentenceDto[] }

export interface PlaylistStatsDto {
  sentences: number; audioReady: number; ttsChars: number; studentsStarted: number;
}

/** Catálogo do aluno: contexto → playlists publicadas, na ordem definida pelo administrador. */
export interface CatalogDto {
  contexts: {
    id: string; slug: string; name: string; description: string; category: string;
    playlists: {
      id: string; slug: string; title: string; description: string; position: number; sentenceCount: number;
      /** Quantas vezes o aluno ouviu a playlist inteira. */
      loopsCompleted: number;
    }[];
  }[];
}

export interface PlayerSentenceDto {
  id: string; position: number; text: string; translationPt?: string; audioUrl?: string; durationMs?: number;
  /** Quantas vezes o aluno ouviu a frase. */
  listenCount: number;
}

export interface StudentPlaylistDto {
  id: string; version: number; contextName: string; title: string; description: string;
  sentences: PlayerSentenceDto[];
  state: { lastSentenceId: string | null; loopsCompleted: number; listenedSeconds: number; clientUpdatedAt: string } | null;
}

export interface AudioInfoDto { url: string; durationMs: number }

export interface OfflineManifestDto {
  playlistId: string; version: number; contextName: string; title: string; description: string;
  sentences: { id: string; position: number; text: string; translationPt?: string; audioUrl: string; durationMs: number }[];
}
