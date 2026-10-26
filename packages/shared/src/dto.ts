import type { PlaylistStatus } from "./catalog";
import type { Role } from "./constants";

export interface LevelDto { id: string; code: string; name: string; sortOrder: number; active: boolean }
export interface TopicDto { id: string; levelId: string; slug: string; name: string; sortOrder: number; active: boolean }
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
  topicId: string; topicName: string; topicSlug: string; levelCode: string;
  sentenceCount: number; audioReady: number;
}

export interface SentenceDto { id: string; position: number; text: string; audioReady: boolean; metadata: Record<string, unknown> | null }

export interface AdminPlaylistDetailDto extends AdminPlaylistDto { sentences: SentenceDto[] }

export interface PlaylistStatsDto {
  sentences: number; audioReady: number; ttsChars: number; studentsStarted: number;
}

/** Catálogo do aluno: contexto → nível → tópico (somente playlists publicadas). */
export interface CatalogDto {
  contexts: {
    id: string; slug: string; name: string; description: string; category: string;
    levels: {
      id: string; code: string; name: string;
      topics: { playlistId: string; topicId: string; name: string; sentenceCount: number }[];
    }[];
  }[];
}

export interface PlayerSentenceDto { id: string; position: number; text: string; audioUrl?: string; durationMs?: number }

export interface StudentPlaylistDto {
  id: string; version: number; contextName: string; levelCode: string; topicName: string;
  sentences: PlayerSentenceDto[];
  state: { lastSentenceId: string | null; loopsCompleted: number; listenedSeconds: number; clientUpdatedAt: string } | null;
}

export interface AudioInfoDto { url: string; durationMs: number }

export interface OfflineManifestDto {
  playlistId: string; version: number; contextName: string; levelCode: string; topicName: string;
  sentences: { id: string; position: number; text: string; audioUrl: string; durationMs: number }[];
}
