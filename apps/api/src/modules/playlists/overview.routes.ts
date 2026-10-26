import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Guard } from "../../http";

export function registerOverviewAdminRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; guards: Guard[] },
): void {
  const opts = { preHandler: deps.guards };

  app.get("/admin/overview", opts, async () => {
    const { rows } = await deps.pool.query<{
      draft: number; empty: number; published: number; archived: number; students: number; audios_ready: number; audios_failed: number; tts_chars: string; orphans: number;
    }>(`SELECT
          (SELECT count(*)::int FROM playlists p WHERE status = 'draft' AND EXISTS (SELECT 1 FROM sentences s WHERE s.playlist_id = p.id)) AS draft,
          (SELECT count(*)::int FROM playlists p WHERE NOT EXISTS (SELECT 1 FROM sentences s WHERE s.playlist_id = p.id)) AS empty,
          (SELECT count(*)::int FROM playlists WHERE status = 'published') AS published,
          (SELECT count(*)::int FROM playlists WHERE status = 'archived') AS archived,
          (SELECT count(*)::int FROM users WHERE role = 'student') AS students,
          (SELECT count(*)::int FROM audios WHERE status = 'ready') AS audios_ready,
          (SELECT count(*)::int FROM audios WHERE status = 'failed') AS audios_failed,
          (SELECT COALESCE(SUM(char_count), 0) FROM audios WHERE status = 'ready') AS tts_chars,
          (SELECT count(*)::int FROM audios a WHERE a.status <> 'pending'
             AND NOT EXISTS (SELECT 1 FROM sentences s WHERE s.text_hash = a.text_hash)) AS orphans`);
    const r = rows[0]!;
    return {
      playlists: { draft: r.draft, empty: r.empty, published: r.published, archived: r.archived },
      students: r.students,
      audios: { ready: r.audios_ready, failed: r.audios_failed, orphans: r.orphans },
      ttsChars: Number(r.tts_chars),
    };
  });
}
