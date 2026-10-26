import type { CatalogDto, PlayerSettings, PlayerState } from "@reouvir/shared";
import type { Queryable } from "../../db/pool";

export interface PublishedPlaylistRow {
  id: string; version: number; context_name: string; level_code: string; topic_name: string;
}
export interface PublishedSentenceRow { id: string; position: number; text: string }

export class StudentRepository {
  constructor(private db: Queryable) {}

  /** Árvore contexto → nível → tópico; só playlists publicadas e itens ativos, na ordem do currículo. */
  async catalog(): Promise<CatalogDto> {
    const { rows } = await this.db.query<{
      playlist_id: string; sentence_count: number;
      context_id: string; context_slug: string; context_name: string; context_description: string; category: string;
      level_id: string; level_code: string; level_name: string;
      topic_id: string; topic_name: string;
    }>(
      `SELECT p.id AS playlist_id,
              (SELECT count(*)::int FROM sentences s WHERE s.playlist_id = p.id) AS sentence_count,
              c.id AS context_id, c.slug AS context_slug, c.name AS context_name,
              c.description AS context_description, c.category,
              l.id AS level_id, l.code AS level_code, l.name AS level_name,
              t.id AS topic_id, t.name AS topic_name
         FROM playlists p
         JOIN contexts c ON c.id = p.context_id AND c.active
         JOIN grammar_topics t ON t.id = p.grammar_topic_id AND t.active
         JOIN levels l ON l.id = t.level_id AND l.active
        WHERE p.status = 'published'
        ORDER BY c.category, c.name, l.sort_order, l.name, t.sort_order, t.name`,
    );
    const contexts: CatalogDto["contexts"] = [];
    for (const r of rows) {
      let ctx = contexts.find((c) => c.id === r.context_id);
      if (!ctx) {
        ctx = { id: r.context_id, slug: r.context_slug, name: r.context_name, description: r.context_description, category: r.category, levels: [] };
        contexts.push(ctx);
      }
      let lvl = ctx.levels.find((l) => l.id === r.level_id);
      if (!lvl) {
        lvl = { id: r.level_id, code: r.level_code, name: r.level_name, topics: [] };
        ctx.levels.push(lvl);
      }
      lvl.topics.push({ playlistId: r.playlist_id, topicId: r.topic_id, name: r.topic_name, sentenceCount: r.sentence_count });
    }
    return { contexts };
  }

  async publishedPlaylist(id: string): Promise<PublishedPlaylistRow | null> {
    const { rows } = await this.db.query<PublishedPlaylistRow>(
      `SELECT p.id, p.version, c.name AS context_name, l.code AS level_code, t.name AS topic_name
         FROM playlists p
         JOIN contexts c ON c.id = p.context_id AND c.active
         JOIN grammar_topics t ON t.id = p.grammar_topic_id AND t.active
         JOIN levels l ON l.id = t.level_id AND l.active
        WHERE p.id = $1 AND p.status = 'published'`,
      [id],
    );
    return rows[0] ?? null;
  }

  async sentences(playlistId: string): Promise<PublishedSentenceRow[]> {
    const { rows } = await this.db.query<PublishedSentenceRow>(
      "SELECT id, position, text FROM sentences WHERE playlist_id = $1 ORDER BY position",
      [playlistId],
    );
    return rows;
  }

  /** Frase de uma playlist publicada (e ativa), ou null. */
  async publishedSentence(id: string): Promise<{ id: string; text: string } | null> {
    const { rows } = await this.db.query<{ id: string; text: string }>(
      `SELECT s.id, s.text FROM sentences s
         JOIN playlists p ON p.id = s.playlist_id AND p.status = 'published'
         JOIN contexts c ON c.id = p.context_id AND c.active
         JOIN grammar_topics t ON t.id = p.grammar_topic_id AND t.active
         JOIN levels l ON l.id = t.level_id AND l.active
        WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async getState(userId: string, playlistId: string) {
    const { rows } = await this.db.query<{
      last_sentence_id: string | null; loops_completed: number; listened_seconds: number; client_updated_at: Date;
    }>("SELECT * FROM user_playlist_state WHERE user_id = $1 AND playlist_id = $2", [userId, playlistId]);
    const r = rows[0];
    return r
      ? { lastSentenceId: r.last_sentence_id, loopsCompleted: r.loops_completed, listenedSeconds: r.listened_seconds, clientUpdatedAt: r.client_updated_at.toISOString() }
      : null;
  }

  /** Em conflito entre aparelhos vale o `client_updated_at` mais recente. */
  async saveState(userId: string, playlistId: string, s: PlayerState): Promise<void> {
    await this.db.query(
      `INSERT INTO user_playlist_state
         (user_id, playlist_id, last_sentence_id, loops_completed, listened_seconds, client_updated_at)
       VALUES ($1,$2,(SELECT id FROM sentences WHERE id = $3 AND playlist_id = $2),$4,$5,$6)
       ON CONFLICT (user_id, playlist_id) DO UPDATE SET
         last_sentence_id = EXCLUDED.last_sentence_id, loops_completed = EXCLUDED.loops_completed,
         listened_seconds = EXCLUDED.listened_seconds, client_updated_at = EXCLUDED.client_updated_at,
         updated_at = now()
       WHERE user_playlist_state.client_updated_at < EXCLUDED.client_updated_at`,
      [userId, playlistId, s.lastSentenceId, s.loopsCompleted, s.listenedSeconds, s.clientUpdatedAt],
    );
  }

  async getSettings(userId: string): Promise<PlayerSettings> {
    const { rows } = await this.db.query<{ repeats: number; speed: string; loop_playlist: boolean }>(
      "SELECT repeats, speed::text, loop_playlist FROM user_settings WHERE user_id = $1",
      [userId],
    );
    const r = rows[0];
    return r ? { repeats: r.repeats, speed: Number(r.speed) === 0.75 ? 0.75 : 1, loop: r.loop_playlist } : { repeats: 2, speed: 1, loop: true };
  }

  async saveSettings(userId: string, s: PlayerSettings): Promise<void> {
    await this.db.query(
      `INSERT INTO user_settings (user_id, repeats, speed, loop_playlist) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET repeats = EXCLUDED.repeats, speed = EXCLUDED.speed, loop_playlist = EXCLUDED.loop_playlist`,
      [userId, s.repeats, s.speed, s.loop],
    );
  }
}
