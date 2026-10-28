import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError } from "@reouvir/api-client";
import { contextInputSchema, playlistInputSchema, playlistUpdateSchema, sentenceTextSchema } from "@reouvir/shared";
import type { AdminSession } from "./session";

const id = z.string().uuid();

async function run(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(data ?? { ok: true }, null, 2) }] };
  } catch (err) {
    const msg = err instanceof ApiError ? `${err.status} ${err.code ?? ""}: ${err.message}` : String(err);
    return { isError: true, content: [{ type: "text" as const, text: msg }] };
  }
}

export function registerTools(server: McpServer, api: AdminSession): void {
  server.tool("list_contexts", "Lista os contextos.", {}, () => run(() => api.request("GET", "/admin/contexts")));

  server.tool(
    "create_context",
    "Cria um contexto (sem playlists). `details` é só para o administrador; `description` o aluno vê.",
    contextInputSchema.shape,
    (args) => run(() => api.request("POST", "/admin/contexts", args)),
  );

  server.tool(
    "list_playlists",
    "Lista as playlists, opcionalmente de um contexto.",
    { contextId: id.optional() },
    ({ contextId }) =>
      run(() => api.request("GET", `/admin/playlists${contextId ? `?contextId=${contextId}` : ""}`)),
  );

  server.tool("get_playlist", "Detalha uma playlist, com as frases.", { playlistId: id }, ({ playlistId }) =>
    run(() => api.request("GET", `/admin/playlists/${playlistId}`)),
  );

  server.tool(
    "create_playlist",
    "Cria uma playlist (rascunho) no fim do contexto. Sem `slug`, ele vem do título.",
    { contextId: id, ...playlistInputSchema.shape },
    ({ contextId, ...body }) => run(() => api.request("POST", `/admin/contexts/${contextId}/playlists`, body)),
  );

  server.tool(
    "update_playlist",
    "Edita título, slug ou descrição de uma playlist; só os campos enviados mudam.",
    { playlistId: id, ...playlistUpdateSchema.shape },
    ({ playlistId, ...body }) => run(() => api.request("PUT", `/admin/playlists/${playlistId}`, body)),
  );

  server.tool(
    "add_sentence",
    "Adiciona uma frase ao fim da playlist.",
    { playlistId: id, ...sentenceTextSchema.shape },
    ({ playlistId, text }) => run(() => api.request("POST", `/admin/playlists/${playlistId}/sentences`, { text })),
  );

  server.tool(
    "add_sentences",
    "Adiciona várias frases ao fim da playlist, na ordem dada, uma chamada por frase. Continua após falhas (ex.: frase repetida) e relata cada uma.",
    { playlistId: id, texts: z.array(sentenceTextSchema.shape.text).min(1).max(500) },
    ({ playlistId, texts }) =>
      run(async () => {
        const failed: { index: number; text: string; error: string }[] = [];
        for (const [index, text] of texts.entries()) {
          try {
            await api.request("POST", `/admin/playlists/${playlistId}/sentences`, { text });
          } catch (err) {
            failed.push({ index, text, error: err instanceof ApiError ? `${err.status}: ${err.message}` : String(err) });
          }
        }
        return { added: texts.length - failed.length, failed };
      }),
  );

  server.tool(
    "update_sentence",
    "Edita o texto de uma frase.",
    { sentenceId: id, ...sentenceTextSchema.shape },
    ({ sentenceId, text }) => run(() => api.request("PATCH", `/admin/sentences/${sentenceId}`, { text })),
  );

  server.tool("delete_sentence", "Remove uma frase (deixa lacuna na numeração).", { sentenceId: id }, ({ sentenceId }) =>
    run(() => api.request("DELETE", `/admin/sentences/${sentenceId}`)),
  );

  server.tool(
    "publish_playlist",
    "Publica um rascunho (precisa ter frases). Depois disso o aluno passa a vê-la.",
    { playlistId: id },
    ({ playlistId }) => run(() => api.request("POST", `/admin/playlists/${playlistId}/publish`)),
  );
}
