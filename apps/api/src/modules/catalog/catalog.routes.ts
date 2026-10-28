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

  app.get("/admin/contexts", opts, () => repo.listContexts());

  /** Um contexto novo nasce sem playlists: o administrador as cria (rotas em playlists.routes.ts). */
  app.post("/admin/contexts", opts, async (req, reply) => {
    const body = contextInputSchema.parse(req.body);
    const ctx = await repo.createContext(body).catch((e) => mapPgError(e, slugTaken));
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
