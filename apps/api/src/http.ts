import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "./errors";

export const idParamSchema = z.object({ id: z.string().uuid() });

export function paramId(req: FastifyRequest): string {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) throw new AppError(404, "Não encontrado", "not_found");
  return parsed.data.id;
}

/** Converte violações de FK/UNIQUE do Postgres em 409. */
export function mapPgError(err: unknown, messages: { unique?: string; fk?: string } = {}): never {
  const code = (err as { code?: string }).code;
  if (code === "23505") throw new AppError(409, messages.unique ?? "Já existe um registro com esses dados", "conflict");
  if (code === "23503") throw new AppError(409, messages.fk ?? "Registro em uso ou referência inexistente", "conflict");
  throw err;
}

export type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
