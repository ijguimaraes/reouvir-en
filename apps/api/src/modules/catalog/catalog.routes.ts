import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { contextInputSchema } from "@reouvir/shared";
import { withTransaction } from "../../db/pool";
import { AppError } from "../../errors";
import { mapPgError, paramId, type Guard } from "../../http";
import { CatalogRepository } from "./catalog.repository";

export function registerCatalogAdminRoutes(app: FastifyInstance, deps: { pool: Pool; guards: Guard[] }): void {
  const { pool } = deps;
  const repo = new CatalogRepository(pool);
  const opts = { preHandler: deps.guards };
  const notFound = () => new AppError(404, "Não encontrado", "not_found");
  const slugTaken = { unique: "Já existe um contexto com esse slug" };

  // Níveis e tópicos são fixos (seed): só leitura.
  app.get("/admin/levels", opts, () => repo.listLevels());
  app.get("/admin/topics", opts, () => repo.listTopics());

  app.get("/admin/contexts", opts, () => repo.listContexts());

  /** Criar um contexto já gera as playlists vazias dele (uma por tópico). */
  app.post("/admin/contexts", opts, async (req, reply) => {
    const body = contextInputSchema.parse(req.body);
    const ctx = await withTransaction(pool, async (client) => {
      const tx = new CatalogRepository(client);
      const created = await tx.createContext(body);
      await tx.ensurePlaylists(created.id);
      return created;
    }).catch((e) => mapPgError(e, slugTaken));
    return reply.code(201).send(ctx);
  });

  app.put("/admin/contexts/:id", opts, async (req) => {
    const body = contextInputSchema.parse(req.body);
    const r = await repo.updateContext(paramId(req), body).catch((e) => mapPgError(e, slugTaken));
    if (!r) throw notFound();
    return r;
  });

  /** Apaga o contexto e as playlists vazias dele; recusa se alguma tiver frases. */
  app.delete("/admin/contexts/:id", opts, async (req, reply) => {
    const result = await withTransaction(pool, (client) => new CatalogRepository(client).deleteContext(paramId(req)));
    if (result === "not_found") throw notFound();
    if (result === "has_sentences") {
      throw new AppError(409, "O contexto tem playlists com frases. Esvazie-as ou desative o contexto.", "has_sentences");
    }
    return reply.code(204).send();
  });
}
