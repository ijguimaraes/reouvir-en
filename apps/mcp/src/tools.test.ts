import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { AdminSession } from "./session";
import { registerTools } from "./tools";

const PLAYLIST = "b2f801d7-7635-46e0-90ab-7f43854dc2be";
const SENTENCE = "6f1c1f3e-1c4e-4b7a-9d55-0d3b5a1e9a10";

async function connect() {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const api = {
    request: async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      return { ok: true };
    },
  } as unknown as AdminSession;
  const server = new McpServer({ name: "t", version: "0" });
  registerTools(server, api);
  const client = new Client({ name: "c", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  return { call, calls };
}

describe("tools de frase aceitam translationPt e recusam chave errada", () => {
  it("add_sentence e add_sentences repassam translationPt", async () => {
    const { call, calls } = await connect();
    expect((await call("add_sentence", { playlistId: PLAYLIST, text: "Hello there.", translationPt: "Olá." })).isError).toBeFalsy();
    expect(calls[0]).toEqual({
      method: "POST", path: `/admin/playlists/${PLAYLIST}/sentences`, body: { text: "Hello there.", translationPt: "Olá." },
    });
    const r = await call("add_sentences", { playlistId: PLAYLIST, sentences: [{ text: "See you.", translationPt: "Até logo." }] });
    expect(r.isError).toBeFalsy();
    expect(calls[1]!.body).toEqual({ text: "See you.", translationPt: "Até logo." });
  });

  it("translation_pt (snake_case) dá erro, não é descartado em silêncio", async () => {
    const { call, calls } = await connect();
    const one = await call("add_sentence", { playlistId: PLAYLIST, text: "Hello there.", translation_pt: "Olá." });
    expect(one.isError).toBe(true);
    const many = await call("add_sentences", { playlistId: PLAYLIST, sentences: [{ text: "See you.", translation_pt: "Até logo." }] });
    expect(many.isError).toBe(true);
    const upd = await call("update_sentence", { sentenceId: SENTENCE, translation_pt: "Olá." });
    expect(upd.isError).toBe(true);
    expect(calls).toHaveLength(0);                     // nada chegou à API
  });

  it("update_sentence repassa só o que veio, inclusive null", async () => {
    const { call, calls } = await connect();
    await call("update_sentence", { sentenceId: SENTENCE, translationPt: "Olá." });
    await call("update_sentence", { sentenceId: SENTENCE, translationPt: null });
    expect(calls.map((c) => c.body)).toEqual([{ translationPt: "Olá." }, { translationPt: null }]);
    expect(calls[0]).toMatchObject({ method: "PATCH", path: `/admin/sentences/${SENTENCE}` });
  });
});
