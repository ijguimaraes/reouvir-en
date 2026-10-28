import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import {
  playerStateSchema,
  settingsSchema,
  type OfflineManifestDto,
  type StudentPlaylistDto,
} from "@reouvir/shared";
import { AppError } from "../../errors";
import { paramId, type Guard } from "../../http";
import type { AudioService } from "../audio/audio.service";
import { StudentRepository } from "./student.repository";


/** Executa `fn` sobre os itens com no máximo `limit` em paralelo (o TTS tem limite de chamadas). */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

export function registerStudentRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; guards: Guard[]; audio: AudioService },
): void {
  const repo = new StudentRepository(deps.pool);
  const opts = { preHandler: deps.guards };
  const notFound = () => new AppError(404, "Não encontrado", "not_found");

  app.get("/catalog", opts, () => repo.catalog());

  app.get("/playlists/:id", opts, async (req): Promise<StudentPlaylistDto> => {
    const id = paramId(req);
    const p = await repo.publishedPlaylist(id);
    if (!p) throw notFound();
    const [sentences, state] = await Promise.all([repo.sentences(id), repo.getState(req.authUser!.id, id)]);
    const withAudio = await Promise.all(
      sentences.map(async (s) => {
        const a = await deps.audio.lookup(s.text);
        return {
          id: s.id, position: s.position, text: s.text, translationPt: s.translation_pt ?? undefined,
          audioUrl: a?.url, durationMs: a?.durationMs,
        };
      }),
    );
    return {
      id: p.id, version: p.version, contextName: p.context_name, title: p.title, description: p.description,
      sentences: withAudio,
      state,
    };
  });

  app.get("/sentences/:id/audio", opts, async (req) => {
    const s = await repo.publishedSentence(paramId(req));
    if (!s) throw notFound();
    return deps.audio.ensure(s.text, req.authUser!.id);
  });

  /** Garante todos os áudios (em pequenos grupos paralelos) e devolve o manifesto offline. */
  app.post("/playlists/:id/prepare", opts, async (req): Promise<OfflineManifestDto> => {
    const id = paramId(req);
    const p = await repo.publishedPlaylist(id);
    if (!p) throw notFound();
    const sentences = await repo.sentences(id);
    const audios = await mapPool(sentences, 4, (s) => deps.audio.ensure(s.text, req.authUser!.id));
    return {
      playlistId: p.id, version: p.version, contextName: p.context_name, title: p.title, description: p.description,
      sentences: sentences.map((s, i) => ({
        id: s.id, position: s.position, text: s.text, translationPt: s.translation_pt ?? undefined,
        audioUrl: audios[i]!.url, durationMs: audios[i]!.durationMs,
      })),
    };
  });

  app.put("/playlists/:id/state", opts, async (req) => {
    const id = paramId(req);
    if (!(await repo.publishedPlaylist(id))) throw notFound();
    await repo.saveState(req.authUser!.id, id, playerStateSchema.parse(req.body));
    return repo.getState(req.authUser!.id, id);
  });

  app.get("/me/settings", opts, (req) => repo.getSettings(req.authUser!.id));
  app.put("/me/settings", opts, async (req) => {
    await repo.saveSettings(req.authUser!.id, settingsSchema.parse(req.body));
    return repo.getSettings(req.authUser!.id);
  });
}
