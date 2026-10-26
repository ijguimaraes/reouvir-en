import { randomInt } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { AppError } from "../../errors";
import { paramId, type Guard } from "../../http";
import { hashPassword } from "../auth/auth.service";
import { withTransaction } from "../../db/pool";
import { UsersRepository } from "./users.repository";


const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 12 caracteres sem símbolos ambíguos (0/O, 1/l/I), para ser repassada ao aluno. */
export function generateTemporaryPassword(): string {
  return Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function registerUsersAdminRoutes(app: FastifyInstance, deps: { pool: Pool; guards: Guard[] }): void {
  const opts = { preHandler: deps.guards };
  const repo = new UsersRepository(deps.pool);

  app.get("/admin/users", opts, () => repo.list());

  app.post("/admin/users/:id/block", opts, async (req, reply) => {
    const id = paramId(req);
    if (id === req.authUser!.id) throw new AppError(400, "Você não pode bloquear a si mesmo", "self_block");
    await withTransaction(deps.pool, async (client) => {
      const tx = new UsersRepository(client);
      if (!(await tx.setStatus(id, "blocked"))) throw new AppError(404, "Não encontrado", "not_found");
      await tx.revokeAllTokens(id);
    });
    return reply.code(204).send();
  });

  app.post("/admin/users/:id/unblock", opts, async (req, reply) => {
    if (!(await repo.setStatus(paramId(req), "active"))) throw new AppError(404, "Não encontrado", "not_found");
    return reply.code(204).send();
  });

  app.post("/admin/users/:id/reset-password", opts, async (req) => {
    const id = paramId(req);
    const temporaryPassword = generateTemporaryPassword();
    const hash = await hashPassword(temporaryPassword);
    await withTransaction(deps.pool, async (client) => {
      const tx = new UsersRepository(client);
      if (!(await tx.setTemporaryPassword(id, hash))) throw new AppError(404, "Não encontrado", "not_found");
      await tx.revokeAllTokens(id);
    });
    // Exibida uma única vez ao administrador; não é guardada em texto.
    return { temporaryPassword };
  });
}
