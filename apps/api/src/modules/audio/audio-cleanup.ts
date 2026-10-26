import type { Pool } from "pg";
import type { Storage } from "../../storage/storage";

export interface CleanupResult {
  orphanAudios: number;
  orphanFiles: number;
  removed: boolean;
}

/**
 * Órfão: áudio cujo texto não existe mais em nenhuma frase (frase editada ou removida),
 * ou arquivo no disco sem linha em `audios`.
 */
export async function cleanupOrphanAudios(pool: Pool, storage: Storage, opts: { dryRun: boolean }): Promise<CleanupResult> {
  const { rows } = await pool.query<{ audio_key: string }>(
    `SELECT a.audio_key FROM audios a
      WHERE a.status <> 'pending' AND NOT EXISTS (SELECT 1 FROM sentences s WHERE s.text_hash = a.text_hash)`,
  );
  const known = new Set((await pool.query<{ audio_key: string }>("SELECT audio_key FROM audios")).rows.map((r) => r.audio_key));
  const strayFiles = (await storage.list()).filter((k) => !known.has(k));

  if (!opts.dryRun) {
    for (const { audio_key } of rows) {
      await storage.remove(audio_key);
      await pool.query("DELETE FROM audios WHERE audio_key = $1", [audio_key]);
    }
    for (const key of strayFiles) await storage.remove(key);
  }
  return { orphanAudios: rows.length, orphanFiles: strayFiles.length, removed: !opts.dryRun };
}
