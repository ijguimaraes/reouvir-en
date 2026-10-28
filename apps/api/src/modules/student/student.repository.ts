import type { CatalogDto, PlayerSettings, PlayerState } from "@reouvir/shared";
import type { Queryable } from "../../db/pool";

export interface PublishedPlaylistRow {
  id: string; version: number; context_name: string; title: string; description: string;
}
export interface PublishedSentenceRow { id: string; position: number; text: string; translation_pt: string | null }

export class StudentRepository {
  constructor(private db: Queryable) {}

  /** Contexto → playlists; só as publicadas, de contextos ativos, na ordem definida pelo administrador. */
  async catalog(userId: string): Promise<CatalogDto> {
    const { rows } = await this.db.query<{
      id: string; slug: string; title: string; description: string; position: number; sentence_count: number;
      loops_completed: number; context_id: string; context_slug: string; context_name: string; context_description: string; category: string;
    }>(
      `SELECT p.id, p.slug, p.title, p.description, p.position,
              (SELECT count(*)::int FROM sentences s WHERE s.playlist_id = p.id) AS sentence_count,
              COALESCE(st.loops_completed, 0) AS loops_completed,
              c.id AS context_id, c.slug AS context_slug, c.name AS context_name,
              c.description AS context_description, c.category
         FROM playlists p
         JOIN contexts c ON c.id = p.context_id AND c.active
    LEFT JOIN user_playlist_state st ON st.playlist_id = p.id AND st.user_id = $1
        WHERE p.status = 'published'
        ORDER BY c.category, c.name, p.position`,
      [userId],
    );
    const contexts: CatalogDto["contexts"] = [];
    for (const r of rows) {
      let ctx = contexts.find((c) => c.id === r.context_id);
      if (!ctx) {
        ctx = { id: r.context_id, slug: r.context_slug, name: r.context_name, description: r.context_description, category: r.category, playlists: [] };
        contexts.push(ctx);
      }
      ctx.playlists.push({ id: r.id, slug: r.slug, title: r.title, description: r.description, position: r.position, sentenceCount: r.sentence_count, loopsCompleted: r.loops_completed });
    }
    return { contexts };
  }

  async publishedPlaylist(id: string): Promise<PublishedPlaylistRow | null> {
    const { rows } = await this.db.query<PublishedPlaylistRow>(
      `SELECT p.id, p.version, c.name AS context_name, p.title, p.description
         FROM playlists p
         JOIN contexts c ON c.id = p.context_id AND c.active
        WHERE p.id = $1 AND p.status = 'published'`,
      [id],
    );
    return rows[0] ?? null;
  }

  async sentences(playlistId: string): Promise<PublishedSentenceRow[]> {
    const { rows } = await this.db.query<PublishedSentenceRow>(
      "SELECT id, position, text, translation_pt FROM sentences WHERE playlist_id = $1 ORDER BY position",
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
        WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Audições por frase da playlist (frases nunca ouvidas ficam de fora). */
  async listenCounts(userId: string, playlistId: string): Promise<Map<string, number>> {
    const { rows } = await this.db.query<{ sentence_id: string; listen_count: number }>(
      `SELECT ss.sentence_id, ss.listen_count FROM user_sentence_stats ss
         JOIN sentences s ON s.id = ss.sentence_id
        WHERE ss.user_id = $1 AND s.playlist_id = $2`,
      [userId, playlistId],
    );
    return new Map(rows.map((r) => [r.sentence_id, r.listen_count]));
  }

  /** Guarda o maior total entre o enviado e o gravado; ignora ids que não são frases da playlist. */
  async saveListenCounts(userId: string, playlistId: string, counts: Record<string, number>): Promise<void> {
    const ids = Object.keys(counts);
    if (!ids.length) return;
    await this.db.query(
      `INSERT INTO user_sentence_stats (user_id, sentence_id, listen_count)
       SELECT $1, s.id, v.n FROM unnest($3::uuid[], $4::int[]) AS v(id, n)
         JOIN sentences s ON s.id = v.id AND s.playlist_id = $2
       ON CONFLICT (user_id, sentence_id) DO UPDATE SET
         listen_count = GREATEST(user_sentence_stats.listen_count, EXCLUDED.listen_count), updated_at = now()`,
      [userId, playlistId, ids, ids.map((i) => counts[i])],
    );
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
    const { rows } = await this.db.query<{
      repeats: number; speed: string; loop_playlist: boolean; show_translation: boolean; keep_screen_on: boolean;
    }>(
      "SELECT repeats, speed::text, loop_playlist, show_translation, keep_screen_on FROM user_settings WHERE user_id = $1",
      [userId],
    );
    const r = rows[0];
    return r
      ? {
          repeats: r.repeats, speed: Number(r.speed) === 0.75 ? 0.75 : 1, loop: r.loop_playlist,
          showTranslation: r.show_translation, keepScreenOn: r.keep_screen_on,
        }
      : { repeats: 2, speed: 1, loop: true, showTranslation: true, keepScreenOn: false };
  }

  async saveSettings(userId: string, s: PlayerSettings): Promise<void> {
    await this.db.query(
      `INSERT INTO user_settings (user_id, repeats, speed, loop_playlist, show_translation, keep_screen_on)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE SET repeats = EXCLUDED.repeats, speed = EXCLUDED.speed,
         loop_playlist = EXCLUDED.loop_playlist, show_translation = EXCLUDED.show_translation,
         keep_screen_on = EXCLUDED.keep_screen_on`,
      [userId, s.repeats, s.speed, s.loop, s.showTranslation, s.keepScreenOn],
    );
  }
}
