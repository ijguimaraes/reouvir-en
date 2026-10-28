import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError } from "@reouvir/api-client";
import {
  contextInputSchema,
  playlistInputSchema,
  playlistUpdateSchema,
  sentenceInputSchema,
  sentenceUpdateBaseSchema,
} from "@reouvir/shared";
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

  // Estritos (z.object, não o shape solto): chave desconhecida, como `translation_pt`, dá erro em vez de sumir.
  server.registerTool(
    "add_sentence",
    {
      description: "Adiciona uma frase ao fim da playlist. `translationPt` (opcional) é a tradução para português.",
      inputSchema: sentenceInputSchema.extend({ playlistId: id }),
    },
    ({ playlistId, ...body }) => run(() => api.request("POST", `/admin/playlists/${playlistId}/sentences`, body)),
  );

  server.tool(
    "add_sentences",
    "Adiciona várias frases ao fim da playlist, na ordem dada, uma chamada por frase. Cada item traz `text` e, opcionalmente, `translationPt`. Continua após falhas (ex.: frase repetida) e relata cada uma.",
    { playlistId: id, sentences: z.array(sentenceInputSchema).min(1).max(500) },
    ({ playlistId, sentences }) =>
      run(async () => {
        const failed: { index: number; text: string; error: string }[] = [];
        for (const [index, sentence] of sentences.entries()) {
          try {
            await api.request("POST", `/admin/playlists/${playlistId}/sentences`, sentence);
          } catch (err) {
            failed.push({ index, text: sentence.text, error: err instanceof ApiError ? `${err.status}: ${err.message}` : String(err) });
          }
        }
        return { added: sentences.length - failed.length, failed };
      }),
  );

  server.registerTool(
    "update_sentence",
    {
      description:
        "Edita o texto e/ou a tradução de uma frase; só o que for enviado muda. `translationPt: null` apaga a tradução.",
      inputSchema: sentenceUpdateBaseSchema.extend({ sentenceId: id }),
    },
    ({ sentenceId, ...body }) => run(() => api.request("PATCH", `/admin/sentences/${sentenceId}`, body)),
  );

  server.tool(
    "translate_playlist",
    "Gera a tradução para português das frases da playlist que ainda não têm (ou de todas, com `overwrite`) e grava. Usa a API da Anthropic no servidor.",
    { playlistId: id, overwrite: z.boolean().default(false) },
    ({ playlistId, overwrite }) =>
      run(async () => {
        const r = await api.request<{ translated: number; skipped: number }>("POST", `/admin/playlists/${playlistId}/translate`, { overwrite });
        return { translated: r.translated, skipped: r.skipped };
      }),
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
