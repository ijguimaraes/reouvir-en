import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import {
  checkSentenceText,
  normalizeText,
  reorderSchema,
  sentenceTextSchema,
} from "@reouvir/shared";
import { withTransaction } from "../../db/pool";
import { AppError } from "../../errors";
import { mapPgError, paramId, type Guard } from "../../http";
import { textHash, type TtsIdentity } from "../audio/audio-key";
import { PlaylistsRepository } from "./playlists.repository";


export function registerPlaylistAdminRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; guards: Guard[]; tts: TtsIdentity },
): void {
  const { pool, tts } = deps;
  const opts = { preHandler: deps.guards };
  const repo = new PlaylistsRepository(pool, tts);
  const notFound = () => new AppError(404, "Não encontrado", "not_found");

  /** Texto normalizado e validado; nível opcional só gera avisos, que não bloqueiam edição manual. */
  function cleanText(raw: string): { text: string; hash: string } {
    const text = normalizeText(raw);
    const { errors } = checkSentenceText(text);
    if (errors.length) throw new AppError(400, `Frase inválida: ${errors.join(", ")}`, "invalid_sentence");
    return { text, hash: textHash(text) };
  }

  app.get("/admin/playlists", opts, async (req) => {
    const { contextId } = (req.query ?? {}) as { contextId?: string };
    return repo.list(contextId);
  });

  app.get("/admin/playlists/:id", opts, async (req) => {
    const p = await repo.get(paramId(req));
    if (!p) throw notFound();
    return p;
  });

  app.get("/admin/playlists/:id/stats", opts, async (req) => {
    const id = paramId(req);
    if (!(await repo.getStatus(id))) throw notFound();
    return repo.stats(id);
  });

  app.post("/admin/playlists/:id/sentences", opts, async (req, reply) => {
    const id = paramId(req);
    const { text, hash } = cleanText(sentenceTextSchema.parse(req.body).text);
    if (!(await repo.getStatus(id))) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      await tx.addSentence(id, text, hash);
    }).catch((e) => mapPgError(e, { unique: "Já existe essa frase na playlist" }));
    return reply.code(201).send(await repo.get(id));
  });

  app.patch("/admin/sentences/:id", opts, async (req) => {
    const id = paramId(req);
    const { text, hash } = cleanText(sentenceTextSchema.parse(req.body).text);
    const sentence = await repo.getSentence(id);
    if (!sentence) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      await tx.updateSentenceText(id, text, hash);
    }).catch((e) => mapPgError(e, { unique: "Já existe essa frase na playlist" }));
    return repo.get(sentence.playlist_id);
  });

  app.delete("/admin/sentences/:id", opts, async (req, reply) => {
    const id = paramId(req);
    const sentence = await repo.getSentence(id);
    if (!sentence) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      await tx.deleteSentence(id);
    });
    return reply.code(204).send();
  });

  app.put("/admin/playlists/:id/order", opts, async (req) => {
    const id = paramId(req);
    const { ids } = reorderSchema.parse(req.body);
    if (!(await repo.getStatus(id))) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      const current = await tx.sentenceIds(id);
      if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((i) => current.includes(i))) {
        throw new AppError(400, "A lista precisa conter exatamente as frases da playlist", "invalid_order");
      }
      await tx.renumber(id, ids);
    });
    return repo.get(id);
  });

  app.post("/admin/playlists/:id/publish", opts, async (req) => {
    const id = paramId(req);
    const cur = await repo.getStatus(id);
    if (!cur) throw notFound();
    if (cur.status !== "draft") throw new AppError(409, "Só rascunhos podem ser publicados", "bad_state");
    if (cur.sentenceCount === 0) throw new AppError(409, "A playlist não tem frases", "empty_playlist");
    await repo.setStatus(id, "published");
    return repo.get(id);
  });

  app.post("/admin/playlists/:id/unpublish", opts, async (req) => {
    const id = paramId(req);
    const cur = await repo.getStatus(id);
    if (!cur) throw notFound();
    if (cur.status === "draft") throw new AppError(409, "A playlist já é um rascunho", "bad_state");
    await repo.setStatus(id, "draft");
    return repo.get(id);
  });

  app.post("/admin/playlists/:id/archive", opts, async (req) => {
    const id = paramId(req);
    const cur = await repo.getStatus(id);
    if (!cur) throw notFound();
    await repo.setStatus(id, "archived");
    return repo.get(id);
  });
}
