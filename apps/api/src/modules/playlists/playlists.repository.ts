import type {
  AdminPlaylistDetailDto,
  AdminPlaylistDto,
  PlaylistStatsDto,
  PlaylistStatus,
  SentenceDto,
} from "@reouvir/shared";
import type { Queryable } from "../../db/pool";
import type { TtsIdentity } from "../audio/audio-key";

interface PlaylistRow {
  id: string; status: PlaylistStatus; version: number;
  context_id: string; context_name: string; title: string; slug: string; description: string; position: number;
  sentence_count: number; audio_ready: number;
}

export interface SentenceRow {
  id: string; playlist_id: string; position: number; text: string; text_hash: string;
  char_count: number; metadata: Record<string, unknown> | null;
}

const toDto = (r: PlaylistRow): AdminPlaylistDto => ({
  id: r.id, status: r.status, version: r.version,
  contextId: r.context_id, contextName: r.context_name,
  title: r.title, slug: r.slug, description: r.description, position: r.position,
  sentenceCount: r.sentence_count, audioReady: r.audio_ready,
});

export class PlaylistsRepository {
  constructor(private db: Queryable, private tts: TtsIdentity) {}

  private readonly selectPlaylist = `
    SELECT p.id, p.status, p.version, c.id AS context_id, c.name AS context_name,
           p.title, p.slug, p.description, p.position,
           (SELECT count(*)::int FROM sentences s WHERE s.playlist_id = p.id) AS sentence_count,
           (SELECT count(*)::int FROM sentences s
              JOIN audios a ON a.text_hash = s.text_hash AND a.voice_id = $1 AND a.model_id = $2
                           AND a.settings_hash = $3 AND a.status = 'ready'
             WHERE s.playlist_id = p.id) AS audio_ready
      FROM playlists p
      JOIN contexts c ON c.id = p.context_id`;

  private get ttsParams(): [string, string, string] {
    return [this.tts.voiceId, this.tts.modelId, this.tts.settingsHash];
  }

  async list(contextId?: string): Promise<AdminPlaylistDto[]> {
    const { rows } = await this.db.query<PlaylistRow>(
      `${this.selectPlaylist}
       WHERE ($4::uuid IS NULL OR p.context_id = $4::uuid)
       ORDER BY c.name, p.position`,
      [...this.ttsParams, contextId ?? null],
    );
    return rows.map(toDto);
  }

  async get(id: string): Promise<AdminPlaylistDetailDto | null> {
    const { rows } = await this.db.query<PlaylistRow>(`${this.selectPlaylist} WHERE p.id = $4`, [...this.ttsParams, id]);
    if (!rows[0]) return null;
    const sentences = await this.db.query<SentenceRow & { audio_ready: boolean }>(
      `SELECT s.*, EXISTS (
          SELECT 1 FROM audios a WHERE a.text_hash = s.text_hash AND a.voice_id = $2 AND a.model_id = $3
             AND a.settings_hash = $4 AND a.status = 'ready') AS audio_ready
         FROM sentences s WHERE s.playlist_id = $1 ORDER BY s.position`,
      [id, ...this.ttsParams],
    );
    const list: SentenceDto[] = sentences.rows.map((s) => ({
      id: s.id, position: s.position, text: s.text, audioReady: s.audio_ready, metadata: s.metadata,
    }));
    return { ...toDto(rows[0]), sentences: list };
  }

  async getStatus(id: string): Promise<{ status: PlaylistStatus; sentenceCount: number } | null> {
    const { rows } = await this.db.query<{ status: PlaylistStatus; n: number }>(
      "SELECT status, (SELECT count(*)::int FROM sentences WHERE playlist_id = p.id) AS n FROM playlists p WHERE id = $1",
      [id],
    );
    return rows[0] ? { status: rows[0].status, sentenceCount: rows[0].n } : null;
  }

  async setStatus(id: string, status: PlaylistStatus): Promise<void> {
    await this.db.query(
      `UPDATE playlists SET status = $2, updated_at = now(),
         published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END
       WHERE id = $1`,
      [id, status],
    );
  }

  // ---- playlists livres (criar, editar, excluir, ordenar dentro do contexto) ----

  async contextExists(contextId: string): Promise<boolean> {
    const { rowCount } = await this.db.query("SELECT 1 FROM contexts WHERE id = $1", [contextId]);
    return (rowCount ?? 0) > 0;
  }

  /** Slug livre dentro do contexto: a base, ou base-2, base-3... */
  async freeSlug(contextId: string, base: string, ignoreId?: string): Promise<string> {
    const { rows } = await this.db.query<{ slug: string }>(
      "SELECT slug FROM playlists WHERE context_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid) AND (slug = $3 OR slug LIKE $3 || '-%')",
      [contextId, ignoreId ?? null, base],
    );
    const taken = new Set(rows.map((r) => r.slug));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  /** Cria no fim do contexto (MAX + 1). Use dentro de uma transação. */
  async create(contextId: string, i: { title: string; slug: string; description: string }): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO playlists (context_id, title, slug, description, position)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlists WHERE context_id = $1))
       RETURNING id`,
      [contextId, i.title, i.slug, i.description],
    );
    return rows[0]!.id;
  }

  /** Só muda o que foi enviado. Renomear não sobe a `version` (ela acompanha as frases). */
  async update(id: string, i: { title?: string; slug?: string; description?: string }): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE playlists SET title = COALESCE($2, title), slug = COALESCE($3, slug),
         description = COALESCE($4, description), updated_at = now()
       WHERE id = $1`,
      [id, i.title ?? null, i.slug ?? null, i.description ?? null],
    );
    return (rowCount ?? 0) > 0;
  }

  async contextOf(id: string): Promise<string | null> {
    const { rows } = await this.db.query<{ context_id: string }>("SELECT context_id FROM playlists WHERE id = $1", [id]);
    return rows[0]?.context_id ?? null;
  }

  /** Exclui só playlist vazia (quem tem frases deve ser arquivada). Fecha a lacuna de posição. Use numa transação. */
  async delete(id: string): Promise<"deleted" | "not_found" | "has_sentences"> {
    const { rows } = await this.db.query<{ context_id: string; n: number }>(
      `SELECT p.context_id, (SELECT count(*)::int FROM sentences s WHERE s.playlist_id = p.id) AS n
         FROM playlists p WHERE p.id = $1 FOR UPDATE`,
      [id],
    );
    if (!rows[0]) return "not_found";
    if (rows[0].n > 0) return "has_sentences";
    await this.db.query("DELETE FROM playlists WHERE id = $1", [id]);
    await this.db.query(
      `UPDATE playlists p SET position = o.pos
         FROM (SELECT id, row_number() OVER (ORDER BY position) AS pos FROM playlists WHERE context_id = $1) o
        WHERE p.id = o.id`,
      [rows[0].context_id],
    );
    return "deleted";
  }

  async playlistIds(contextId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>("SELECT id FROM playlists WHERE context_id = $1", [contextId]);
    return rows.map((r) => r.id);
  }

  /** Renumera as playlists do contexto de 1 a n na ordem recebida (o UNIQUE é DEFERRABLE; use numa transação). */
  async renumberPlaylists(contextId: string, orderedIds: string[]): Promise<void> {
    await this.db.query(
      `UPDATE playlists p SET position = o.pos, updated_at = now()
         FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, pos)
        WHERE p.id = o.id AND p.context_id = $1`,
      [contextId, orderedIds],
    );
  }

  async getSentence(id: string): Promise<SentenceRow | null> {
    const { rows } = await this.db.query<SentenceRow>("SELECT * FROM sentences WHERE id = $1", [id]);
    return rows[0] ?? null;
  }

  async updateSentenceText(id: string, text: string, hash: string): Promise<void> {
    await this.db.query(
      "UPDATE sentences SET text = $2, text_hash = $3, char_count = $4, updated_at = now() WHERE id = $1",
      [id, text, hash, text.length],
    );
  }

  async deleteSentence(id: string): Promise<void> {
    await this.db.query("DELETE FROM sentences WHERE id = $1", [id]);
  }

  /** Última posição + 1; remover frases deixa lacunas, então usa MAX e não COUNT. */
  async addSentence(playlistId: string, text: string, hash: string): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO sentences (playlist_id, position, text, text_hash, char_count)
       VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM sentences WHERE playlist_id = $1), $2, $3, $4)
       RETURNING id`,
      [playlistId, text, hash, text.length],
    );
    return rows[0]!.id;
  }

  async sentenceIds(playlistId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>("SELECT id FROM sentences WHERE playlist_id = $1", [playlistId]);
    return rows.map((r) => r.id);
  }

  /** Renumera de 1 a n na ordem recebida (o UNIQUE é DEFERRABLE; use dentro de uma transação). */
  async renumber(playlistId: string, orderedIds: string[]): Promise<void> {
    await this.db.query(
      `UPDATE sentences s SET position = o.pos
         FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, pos)
        WHERE s.id = o.id AND s.playlist_id = $1`,
      [playlistId, orderedIds],
    );
  }

  async stats(playlistId: string): Promise<PlaylistStatsDto> {
    const { rows } = await this.db.query<{ sentences: number; audio_ready: number; tts_chars: string; students: number }>(
      `SELECT
         (SELECT count(*)::int FROM sentences WHERE playlist_id = $1) AS sentences,
         (SELECT count(*)::int FROM sentences s JOIN audios a ON a.text_hash = s.text_hash
            AND a.voice_id = $2 AND a.model_id = $3 AND a.settings_hash = $4 AND a.status = 'ready'
           WHERE s.playlist_id = $1) AS audio_ready,
         (SELECT COALESCE(SUM(a.char_count), 0) FROM audios a WHERE a.status = 'ready' AND a.text_hash IN
            (SELECT text_hash FROM sentences WHERE playlist_id = $1)) AS tts_chars,
         (SELECT count(*)::int FROM user_playlist_state WHERE playlist_id = $1) AS students`,
      [playlistId, ...this.ttsParams],
    );
    const r = rows[0]!;
    return { sentences: r.sentences, audioReady: r.audio_ready, ttsChars: Number(r.tts_chars), studentsStarted: r.students };
  }
}
