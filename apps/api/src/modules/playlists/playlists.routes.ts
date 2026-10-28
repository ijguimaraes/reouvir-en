import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import {
  checkSentenceText,
  normalizeText,
  playlistInputSchema,
  playlistUpdateSchema,
  reorderSchema,
  sentenceInputSchema,
  sentenceUpdateSchema,
  slugify,
} from "@reouvir/shared";
import { withTransaction } from "../../db/pool";
import { AppError } from "../../errors";
import { mapPgError, paramId, type Guard } from "../../http";
import { textHash, type TtsIdentity } from "../audio/audio-key";
import type { Translator } from "../translation/translator";
import { PlaylistsRepository } from "./playlists.repository";

/** Frases por chamada ao tradutor: playlists grandes viram vários lotes. */
const TRANSLATE_BATCH = 40;

const translateBodySchema = z.object({ overwrite: z.boolean().default(false) });


export function registerPlaylistAdminRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; guards: Guard[]; tts: TtsIdentity; translator: Translator },
): void {
  const { pool, tts, translator } = deps;
  const opts = { preHandler: deps.guards };
  const repo = new PlaylistsRepository(pool, tts);
  const notFound = () => new AppError(404, "Não encontrado", "not_found");

  /** Texto normalizado e validado; só erros bloqueiam (avisos de faixa de palavras não bloqueiam edição manual). */
  function cleanText(raw: string): { text: string; hash: string } {
    const text = normalizeText(raw);
    const { errors } = checkSentenceText(text);
    if (errors.length) throw new AppError(400, `Frase inválida: ${errors.join(", ")}`, "invalid_sentence");
    return { text, hash: textHash(text) };
  }

  /** Tradução normalizada (aspas e espaços); vazio ou ausente vira null. Aceita acento e dígito, ao contrário do inglês. */
  const cleanTranslation = (raw: string | null | undefined): string | null => (raw ? normalizeText(raw) || null : null);

  const slugTaken = { unique: "Já existe uma playlist com esse slug neste contexto" };

  /** Cria uma playlist no fim do contexto. Sem `slug`, ele vem do título. */
  app.post("/admin/contexts/:id/playlists", opts, async (req, reply) => {
    const contextId = paramId(req);
    const body = playlistInputSchema.parse(req.body);
    if (!(await repo.contextExists(contextId))) throw notFound();
    const id = await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      const slug = body.slug ?? (await tx.freeSlug(contextId, slugify(body.title) || "playlist"));
      return tx.create(contextId, { title: body.title, slug, description: body.description });
    }).catch((e) => mapPgError(e, slugTaken));
    return reply.code(201).send(await repo.get(id));
  });

  /** Reordena as playlists do contexto: recebe todos os ids na nova ordem e renumera de 1 a n. */
  app.put("/admin/contexts/:id/playlists/order", opts, async (req) => {
    const contextId = paramId(req);
    const { ids } = reorderSchema.parse(req.body);
    if (!(await repo.contextExists(contextId))) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      const current = await tx.playlistIds(contextId);
      if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((i) => current.includes(i))) {
        throw new AppError(400, "A lista precisa conter exatamente as playlists do contexto", "invalid_order");
      }
      await tx.renumberPlaylists(contextId, ids);
    });
    return repo.list(contextId);
  });

  /** Título, slug e descrição. Só muda o que vier no corpo. */
  app.put("/admin/playlists/:id", opts, async (req) => {
    const id = paramId(req);
    const body = playlistUpdateSchema.parse(req.body);
    const ok = await repo.update(id, body).catch((e) => mapPgError(e, slugTaken));
    if (!ok) throw notFound();
    return repo.get(id);
  });

  /** Só playlist vazia; com frases, arquive. */
  app.delete("/admin/playlists/:id", opts, async (req, reply) => {
    const result = await withTransaction(pool, (client) => new PlaylistsRepository(client, tts).delete(paramId(req)));
    if (result === "not_found") throw notFound();
    if (result === "has_sentences") {
      throw new AppError(409, "A playlist tem frases. Arquive-a em vez de excluir.", "has_sentences");
    }
    return reply.code(204).send();
  });

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
    const body = sentenceInputSchema.parse(req.body);
    const { text, hash } = cleanText(body.text);
    if (!(await repo.getStatus(id))) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      await tx.addSentence(id, text, hash, cleanTranslation(body.translationPt));
    }).catch((e) => mapPgError(e, { unique: "Já existe essa frase na playlist" }));
    return reply.code(201).send(await repo.get(id));
  });

  /** Edita o texto, a tradução ou os dois. Só o que vier no corpo muda; `translationPt: null` apaga a tradução. */
  app.patch("/admin/sentences/:id", opts, async (req) => {
    const id = paramId(req);
    const body = sentenceUpdateSchema.parse(req.body);
    const clean = body.text === undefined ? null : cleanText(body.text);
    const sentence = await repo.getSentence(id);
    if (!sentence) throw notFound();
    await withTransaction(pool, async (client) => {
      const tx = new PlaylistsRepository(client, tts);
      if (clean) await tx.updateSentenceText(id, clean.text, clean.hash);
      if (body.translationPt !== undefined) await tx.updateSentenceTranslation(id, cleanTranslation(body.translationPt));
    }).catch((e) => mapPgError(e, { unique: "Já existe essa frase na playlist" }));
    return repo.get(sentence.playlist_id);
  });

  /**
   * Gera a tradução das frases que ainda não têm (ou de todas, com `overwrite`) e grava na playlist.
   * Lotes sequenciais; se um lote falha, os anteriores já ficaram gravados e a chamada pode ser repetida.
   */
  app.post("/admin/playlists/:id/translate", opts, async (req) => {
    const id = paramId(req);
    const { overwrite } = translateBodySchema.parse(req.body ?? {});
    const playlist = await repo.get(id);
    if (!playlist) throw notFound();
    const pending = await repo.sentencesToTranslate(id, overwrite);
    let translated = 0;
    for (let i = 0; i < pending.length; i += TRANSLATE_BATCH) {
      const batch = pending.slice(i, i + TRANSLATE_BATCH);
      const out = await translator.translate({
        context: playlist.contextName, playlist: playlist.title, sentences: batch.map((s) => s.text),
      });
      translated += await repo.saveTranslations(batch.map((s) => s.id), out.map((t) => normalizeText(t)), overwrite);
    }
    return { translated, skipped: pending.length - translated, playlist: await repo.get(id) };
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
