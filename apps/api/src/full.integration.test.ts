import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { createPool } from "./db/pool";
import { LocalStorage } from "./storage/storage";
import { fakeMp3, testConfig } from "./test-utils";
import { hashPassword } from "./modules/auth/auth.service";
import { normalizeText } from "@reouvir/shared";
import { textHash } from "./modules/audio/audio-key";
import type { TtsProvider } from "./modules/audio/tts";
import type { TranslateRequest, Translator } from "./modules/translation/translator";

const url = process.env.DATABASE_URL_TEST;
const SENTENCES = [
  "I am a Java developer.", "My name is Carlos.", "I am from Brazil.", "The company is in the city center.",
  "Are you ready for the interview?", "I am not nervous today.", "The team is very friendly.", "Is this the right room?",
];

class FakeTts implements TtsProvider {
  calls = 0;
  async synthesize(): Promise<Buffer> {
    this.calls++;
    await new Promise((r) => setTimeout(r, 40));
    return fakeMp3(100);
  }
}

class FakeTranslator implements Translator {
  calls: TranslateRequest[] = [];
  async translate(req: TranslateRequest): Promise<string[]> {
    this.calls.push(req);
    return req.sentences.map((s) => `PT: ${s}`);
  }
}

describe.skipIf(!url)("admin + aluno (integração)", () => {
  const pool = createPool(url ?? "postgres://invalid");
  const tts = new FakeTts();
  const translator = new FakeTranslator();
  let app: FastifyInstance;
  let dir: string;
  let admin: Record<string, string>;
  let student: Record<string, string>;
  let studentId: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "reouvir-audio-"));
    app = await buildApp({ config: testConfig(url!, { AUTH_LOGIN_MAX_PER_IP: "10000", AUTH_LOGIN_MAX_PER_EMAIL: "10000" }), pool, storage: new LocalStorage(dir), tts, translator });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  });

  async function login(email: string, password: string) {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
    expect(res.statusCode).toBe(200);
    return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
  }

  beforeEach(async () => {
    await pool.query("TRUNCATE users, contexts, audios CASCADE");
    tts.calls = 0;
    translator.calls = [];
    const hash = await hashPassword("senha-boa-123");
    await pool.query("INSERT INTO users (email, name, password_hash, role) VALUES ('admin@t.com','Admin',$1,'admin')", [hash]);
    const s = await pool.query("INSERT INTO users (email, name, password_hash) VALUES ('aluno@t.com','Aluno',$1) RETURNING id", [hash]);
    studentId = s.rows[0].id;
    admin = await login("admin@t.com", "senha-boa-123");
    student = await login("aluno@t.com", "senha-boa-123");
  });

  const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, who: Record<string, string>, payload?: unknown) =>
    app.inject({ method, url: `/api${url}`, cookies: { access_token: who.access_token! }, payload: payload as object | undefined });

  // ---------- catálogo ----------
  it("aluno não acessa o backoffice; anônimo recebe 401", async () => {
    expect((await call("GET", "/admin/contexts", student)).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/admin/contexts" })).statusCode).toBe(401);
  });

  async function makeContext(slug = "entrevista-java") {
    const res = await call("POST", "/admin/contexts", admin, { slug, name: "Entrevista Java", category: "Trabalho", description: "d" });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }
  type PlaylistRow = {
    id: string; slug: string; title: string; description: string; position: number;
    status: string; sentenceCount: number; version: number;
  };
  async function playlistsOf(contextId: string) {
    return (await call("GET", `/admin/playlists?contextId=${contextId}`, admin)).json() as PlaylistRow[];
  }
  async function makePlaylist(contextId: string, title = "Verbo to be", extra: Record<string, unknown> = {}) {
    const res = await call("POST", `/admin/contexts/${contextId}/playlists`, admin, { title, ...extra });
    expect(res.statusCode).toBe(201);
    return res.json() as PlaylistRow;
  }
  /** A playlist do contexto com esse slug; se ainda não existe, é criada (com o título igual ao slug). */
  const playlistOf = async (contextId: string, slug = "verbo-to-be") =>
    (await playlistsOf(contextId)).find((p) => p.slug === slug) ?? makePlaylist(contextId, slug);

  it("níveis e tópicos não existem mais", async () => {
    expect((await call("GET", "/admin/levels", admin)).statusCode).toBe(404);
    expect((await call("GET", "/admin/topics", admin)).statusCode).toBe(404);
    const { rows } = await pool.query("SELECT to_regclass('levels') AS l, to_regclass('grammar_topics') AS t");
    expect(rows[0]).toEqual({ l: null, t: null });
  });

  it("um contexto novo nasce sem playlists, e o slug do contexto é único", async () => {
    const ctx = await makeContext();
    expect(await playlistsOf(ctx.id)).toEqual([]);
    expect((await call("POST", "/admin/contexts", admin, { slug: "entrevista-java", name: "x", category: "y" })).statusCode).toBe(409);
    expect((await call("GET", "/admin/playlists", admin)).json()).toHaveLength(0);
  });

  it("playlists livres: criar gera o slug do título, vai para o fim e o slug é único no contexto", async () => {
    const a = await makeContext("ctx-a");
    const b = await makeContext("ctx-b");
    const first = await makePlaylist(a.id, "Verbo to be");
    expect(first).toMatchObject({ slug: "verbo-to-be", title: "Verbo to be", description: "", position: 1, status: "draft", sentenceCount: 0 });
    const second = await makePlaylist(a.id, "Verbo to be", { description: "Segunda versão" });
    expect(second).toMatchObject({ slug: "verbo-to-be-2", position: 2, description: "Segunda versão" });
    expect((await makePlaylist(a.id, "Café & Chá!")).slug).toBe("cafe-cha");

    expect((await call("POST", `/admin/contexts/${a.id}/playlists`, admin, { title: "Outra", slug: "verbo-to-be" })).statusCode).toBe(409);
    expect((await makePlaylist(b.id, "Verbo to be", { slug: "verbo-to-be" })).position).toBe(1); // outro contexto: pode repetir
    expect((await call("POST", `/admin/contexts/${a.id}/playlists`, admin, { title: "" })).statusCode).toBe(400);
    expect((await call("POST", "/admin/contexts/00000000-0000-0000-0000-000000000000/playlists", admin, { title: "x" })).statusCode).toBe(404);
  });

  it("playlists livres: editar muda só o que vem no corpo e não sobe a versão", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id, "Primeira", { description: "Descrição original" });
    const other = await makePlaylist(ctx.id, "Segunda");

    const renamed = await call("PUT", `/admin/playlists/${pl.id}`, admin, { title: "Primeira renomeada" });
    expect(renamed.json()).toMatchObject({ title: "Primeira renomeada", slug: "primeira", description: "Descrição original", version: pl.version });
    const described = await call("PUT", `/admin/playlists/${pl.id}`, admin, { description: "" });
    expect(described.json()).toMatchObject({ title: "Primeira renomeada", description: "" });
    expect((await call("PUT", `/admin/playlists/${pl.id}`, admin, { slug: "novo-slug" })).json().slug).toBe("novo-slug");

    expect((await call("PUT", `/admin/playlists/${pl.id}`, admin, { slug: other.slug })).statusCode).toBe(409);
    expect((await call("PUT", `/admin/playlists/${pl.id}`, admin, { slug: "Slug Inválido" })).statusCode).toBe(400);
    expect((await call("PUT", "/admin/playlists/00000000-0000-0000-0000-000000000000", admin, { title: "x" })).statusCode).toBe(404);
  });

  it("playlists livres: reordenar renumera de 1 a n e a lista recusa ids que não batem", async () => {
    const ctx = await makeContext();
    const [a, b, c] = [await makePlaylist(ctx.id, "A"), await makePlaylist(ctx.id, "B"), await makePlaylist(ctx.id, "C")];
    expect((await playlistsOf(ctx.id)).map((p) => p.slug)).toEqual(["a", "b", "c"]);

    const res = await call("PUT", `/admin/contexts/${ctx.id}/playlists/order`, admin, { ids: [c!.id, a!.id, b!.id] });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((p: PlaylistRow) => [p.slug, p.position])).toEqual([["c", 1], ["a", 2], ["b", 3]]);

    const bad = (ids: string[]) => call("PUT", `/admin/contexts/${ctx.id}/playlists/order`, admin, { ids });
    expect((await bad([a!.id, b!.id])).statusCode).toBe(400);
    expect((await bad([a!.id, a!.id, b!.id])).statusCode).toBe(400);
    expect((await bad([a!.id, b!.id, "00000000-0000-0000-0000-000000000000"])).statusCode).toBe(400);
    expect((await playlistsOf(ctx.id)).map((p) => p.slug)).toEqual(["c", "a", "b"]); // nada mudou
    // uma playlist de outro contexto não entra na ordem
    const other = await makeContext("ctx-b");
    const foreign = await makePlaylist(other.id, "Z");
    expect((await bad([a!.id, b!.id, foreign.id])).statusCode).toBe(400);
  });

  it("playlists livres: excluir só playlist vazia e fecha a lacuna de posição", async () => {
    const ctx = await makeContext();
    const [a, b, c] = [await makePlaylist(ctx.id, "A"), await makePlaylist(ctx.id, "B"), await makePlaylist(ctx.id, "C")];
    await call("POST", `/admin/playlists/${b!.id}/sentences`, admin, { text: "Hello there my friend." });

    const refused = await call("DELETE", `/admin/playlists/${b!.id}`, admin);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe("has_sentences");

    expect((await call("DELETE", `/admin/playlists/${a!.id}`, admin)).statusCode).toBe(204);
    expect((await playlistsOf(ctx.id)).map((p) => [p.slug, p.position])).toEqual([["b", 1], ["c", 2]]);
    expect((await call("DELETE", `/admin/playlists/${a!.id}`, admin)).statusCode).toBe(404);
    expect(c!.id).toBeTruthy();
  });

  it("excluir contexto apaga as playlists vazias, mas recusa se alguma tiver frases", async () => {
    const empty = await makeContext("vazio");
    await makePlaylist(empty.id, "Vazia");
    expect((await call("DELETE", `/admin/contexts/${empty.id}`, admin)).statusCode).toBe(204);
    expect((await pool.query("SELECT 1 FROM playlists")).rowCount).toBe(0);

    const used = await makeContext("usado");
    const pl = await playlistOf(used.id);
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend." });
    const res = await call("DELETE", `/admin/contexts/${used.id}`, admin);
    expect(res.statusCode).toBe(409);
    expect((await call("GET", "/admin/playlists", admin)).json()).toHaveLength(1); // nada foi apagado
    expect((await call("DELETE", "/admin/contexts/00000000-0000-0000-0000-000000000000", admin)).statusCode).toBe(404);
  });

  it("usuários: bloquear revoga sessão, não bloqueia a si mesmo, reset exige troca", async () => {
    const adminId = (await call("GET", "/auth/me", admin)).json().user.id;
    expect((await call("POST", `/admin/users/${adminId}/block`, admin)).statusCode).toBe(400);

    expect((await call("POST", `/admin/users/${studentId}/block`, admin)).statusCode).toBe(204);
    const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { refresh_token: student.refresh_token! } });
    expect(refresh.statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "aluno@t.com", password: "senha-boa-123" } })).statusCode).toBe(403);
    expect((await call("POST", `/admin/users/${studentId}/unblock`, admin)).statusCode).toBe(204);

    const reset = await call("POST", `/admin/users/${studentId}/reset-password`, admin);
    const temp = reset.json().temporaryPassword as string;
    expect(temp).toHaveLength(12);
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "aluno@t.com", password: temp } });
    expect(res.json().user.mustChangePassword).toBe(true);
    expect((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "aluno@t.com", password: "senha-boa-123" } })).statusCode).toBe(401);
    const list = (await call("GET", "/admin/users", admin)).json();
    expect(list).toHaveLength(2);
    expect(list[0]).not.toHaveProperty("password_hash");
  });

  // ---------- conteúdo vindo da pipeline (direto no banco) ----------
  /** Simula a pipeline: insere só o texto das frases, num único INSERT. */
  async function pipelineInsert(playlistId: string, texts: string[]) {
    await pool.query(
      `INSERT INTO sentences (playlist_id, position, text)
       SELECT $1, o.pos, o.text FROM unnest($2::text[]) WITH ORDINALITY AS o(text, pos)`,
      [playlistId, texts],
    );
  }
  /** Contexto novo com a playlist "verbo-to-be" (criada no backoffice) preenchida pela "pipeline" (rascunho). */
  async function importedPlaylist() {
    const ctx = await makeContext();
    const pl = await playlistOf(ctx.id);
    await pipelineInsert(pl.id, SENTENCES);
    return pl;
  }

  it("contexto: cria, edita e exclui com o campo de detalhamento; o aluno não o vê", async () => {
    const details = "Cenário: entrevista técnica.\nObjetivo: responder perguntas sobre Java e Spring.";
    const created = await call("POST", "/admin/contexts", admin, { slug: "ctx-detalhe", name: "Com detalhe", category: "Trabalho", description: "curta", details });
    expect(created.statusCode).toBe(201);
    expect(created.json().details).toBe(details);

    const edited = await call("PUT", `/admin/contexts/${created.json().id}`, admin, { slug: "ctx-detalhe", name: "Com detalhe", category: "Trabalho", description: "curta", details: "Novo detalhamento" });
    expect(edited.json().details).toBe("Novo detalhamento");
    expect((await call("GET", "/admin/contexts", admin)).json()[0].details).toBe("Novo detalhamento");

    // sem o campo, vale o padrão vazio
    const bare = await call("POST", "/admin/contexts", admin, { slug: "sem-detalhe", name: "Sem", category: "X" });
    expect(bare.json().details).toBe("");

    const pl = await playlistOf(created.json().id);
    await pipelineInsert(pl.id, ["Hello there my friend."]);
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);
    const catalog = JSON.stringify((await call("GET", "/catalog", student)).json());
    expect(catalog).toContain("curta");
    expect(catalog).not.toContain("Novo detalhamento");

    expect((await call("DELETE", `/admin/contexts/${bare.json().id}`, admin)).statusCode).toBe(204);
  });

  it("pipeline: o banco normaliza o texto e deriva text_hash e char_count", async () => {
    const pl = await playlistOf((await makeContext()).id);
    await pipelineInsert(pl.id, ["  I’m   “ready”…  "]);
    const { rows } = await pool.query("SELECT text, text_hash, char_count FROM sentences WHERE playlist_id = $1", [pl.id]);
    expect(rows[0].text).toBe('I\'m "ready"...');
    expect(rows[0].text_hash).toBe(textHash('I\'m "ready"...'));
    expect(rows[0].char_count).toBe(rows[0].text.length);
  });

  it("a normalização do banco é igual à do código (inclui NBSP e espaços Unicode)", async () => {
    const samples = [
      "  espaços   duplos  ", "aspas ‘simples’ e “duplas”", "reticências… no fim", "NBSP\u00a0aqui", "fino\u2009e\u202festreito",
      "tab\te\nquebra", "ʼapóstrofo modificador", "Cafe\u0301 com acento combinado", "\u3000ideográfico\u3000", "\ufeffcom BOM",
    ];
    for (const sample of samples) {
      const { rows } = await pool.query("SELECT normalize_sentence($1) AS t", [sample]);
      expect(rows[0].t, JSON.stringify(sample)).toBe(normalizeText(sample));
    }
  });

  it("pipeline: frase vazia é recusada e duplicata na playlist também", async () => {
    const pl = await playlistOf((await makeContext()).id);
    await expect(pipelineInsert(pl.id, ["   "])).rejects.toThrow(/frase vazia/);
    await expect(pipelineInsert(pl.id, ["Same sentence here.", "Same   sentence here."])).rejects.toThrow(/duplicate key/);
    expect((await playlistOf((await pool.query("SELECT context_id FROM playlists WHERE id=$1", [pl.id])).rows[0].context_id)).sentenceCount).toBe(0);
  });

  it("a versão da playlist sobe uma vez por comando, em qualquer escrita", async () => {
    const ctx = await makeContext();
    const pl = await playlistOf(ctx.id);
    const version = async () => (await playlistOf(ctx.id)).version;
    const v0 = await version();
    await pipelineInsert(pl.id, SENTENCES); // 8 frases num INSERT
    expect(await version()).toBe(v0 + 1);
    await pool.query("UPDATE sentences SET text = text || ' ok' WHERE playlist_id = $1", [pl.id]);
    expect(await version()).toBe(v0 + 2);
    await pool.query("DELETE FROM sentences WHERE playlist_id = $1 AND position = 1", [pl.id]);
    expect(await version()).toBe(v0 + 3);
    // pelo backoffice (editar, adicionar, remover, reordenar) também conta, uma vez cada
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "One more fine sentence." });
    expect(await version()).toBe(v0 + 4);
  });

  it("cobertura de áudio funciona para frases inseridas direto no banco", async () => {
    const pl = await importedPlaylist();
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);
    const sid = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences[0].id;
    await call("GET", `/sentences/${sid}/audio`, student);
    expect((await call("GET", `/admin/playlists/${pl.id}/stats`, admin)).json()).toMatchObject({ sentences: 8, audioReady: 1 });
  });

  it("revisão: editar, remover (lacuna), adicionar no fim, reordenar renumera de 1 a n", async () => {
    const pl = await importedPlaylist();
    let detail = (await call("GET", `/admin/playlists/${pl.id}`, admin)).json();
    const n = detail.sentences.length;

    const edit = await call("PATCH", `/admin/sentences/${detail.sentences[0].id}`, admin, { text: "  I   am edited now. " });
    expect(edit.json().sentences[0].text).toBe("I am edited now.");
    expect((await call("PATCH", `/admin/sentences/${detail.sentences[0].id}`, admin, { text: "visit www.site.com" })).statusCode).toBe(400);
    expect((await call("PATCH", `/admin/sentences/${detail.sentences[0].id}`, admin, { text: detail.sentences[1].text })).statusCode).toBe(409);

    await call("DELETE", `/admin/sentences/${detail.sentences[1].id}`, admin);
    detail = (await call("GET", `/admin/playlists/${pl.id}`, admin)).json();
    expect(detail.sentences).toHaveLength(n - 1);
    expect(detail.sentences[1].position).toBe(3); // lacuna na posição 2

    const added = (await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "A brand new last sentence." })).json();
    expect(added.sentences.at(-1).text).toBe("A brand new last sentence.");
    expect(added.sentences.at(-1).position).toBe(n + 1);

    const ids = added.sentences.map((s: { id: string }) => s.id).reverse();
    const reordered = (await call("PUT", `/admin/playlists/${pl.id}/order`, admin, { ids })).json();
    expect(reordered.sentences.map((s: { position: number }) => s.position)).toEqual(ids.map((_: string, i: number) => i + 1));
    expect(reordered.sentences[0].text).toBe("A brand new last sentence.");
    expect((await call("PUT", `/admin/playlists/${pl.id}/order`, admin, { ids: ids.slice(1) })).statusCode).toBe(400);
  });

  it("tradução: entra junto da frase, edita sem mexer no texto e sobe a versão", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id);
    const created = (
      await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend.", translationPt: "  Olá,   meu amigo. " })
    ).json();
    expect(created.sentences[0].translationPt).toBe("Olá, meu amigo.");
    expect(created.version).toBeGreaterThan(pl.version);

    const semTraducao = (await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "See you tomorrow." })).json();
    expect(semTraducao.sentences[1].translationPt).toBeNull();

    const [first, second] = semTraducao.sentences;
    const before = semTraducao.version;
    const edited = (await call("PATCH", `/admin/sentences/${first.id}`, admin, { translationPt: "Oi, amigo." })).json();
    expect(edited.sentences[0]).toMatchObject({ text: "Hello there my friend.", translationPt: "Oi, amigo." });
    expect(edited.version).toBeGreaterThan(before);

    const cleared = (await call("PATCH", `/admin/sentences/${first.id}`, admin, { translationPt: null })).json();
    expect(cleared.sentences[0].translationPt).toBeNull();
    expect((await call("PATCH", `/admin/sentences/${second.id}`, admin, {})).statusCode).toBe(400);

    // a tradução não entra na chave do áudio
    const { rows } = await pool.query("SELECT text_hash FROM sentences WHERE id = $1", [first.id]);
    expect(rows[0].text_hash).toBe(textHash("Hello there my friend."));
  });

  it("tradução: chave desconhecida é recusada (400) e a mensagem diz qual", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id);
    const bad = await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend.", translation_pt: "Olá." });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toContain("translation_pt");
    expect((await call("GET", `/admin/playlists/${pl.id}`, admin)).json().sentences).toHaveLength(0); // nada foi gravado

    const ok = (await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend." })).json();
    const patch = await call("PATCH", `/admin/sentences/${ok.sentences[0].id}`, admin, { translation_pt: "Olá." });
    expect(patch.statusCode).toBe(400);
    expect(patch.json().error.message).toContain("translation_pt");
  });

  it("tradução: o aluno recebe no player e no manifesto offline", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id);
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend.", translationPt: "Olá, meu amigo." });
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "See you tomorrow." });
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);

    const player = (await call("GET", `/playlists/${pl.id}`, student)).json();
    expect(player.sentences.map((s: { translationPt?: string }) => s.translationPt)).toEqual(["Olá, meu amigo.", undefined]);
    const manifest = (await call("POST", `/playlists/${pl.id}/prepare`, student)).json();
    expect(manifest.sentences[0].translationPt).toBe("Olá, meu amigo.");
  });

  it("tradução: /translate preenche só as pendentes; overwrite refaz todas", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id, "Apresentação");
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend.", translationPt: "Tradução manual." });
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "See you tomorrow." });
    const versionBefore = (await call("GET", `/admin/playlists/${pl.id}`, admin)).json().version;

    const res = (await call("POST", `/admin/playlists/${pl.id}/translate`, admin, {})).json();
    expect(res).toMatchObject({ translated: 1, skipped: 0 });
    expect(translator.calls).toHaveLength(1);
    expect(translator.calls[0]).toMatchObject({ context: "Entrevista Java", playlist: "Apresentação", sentences: ["See you tomorrow."] });
    expect(res.playlist.sentences.map((s: { translationPt: string }) => s.translationPt)).toEqual(["Tradução manual.", "PT: See you tomorrow."]);
    expect(res.playlist.version).toBe(versionBefore + 1);

    // nada pendente: não chama o tradutor
    expect((await call("POST", `/admin/playlists/${pl.id}/translate`, admin, {})).json()).toMatchObject({ translated: 0 });
    expect(translator.calls).toHaveLength(1);

    const all = (await call("POST", `/admin/playlists/${pl.id}/translate`, admin, { overwrite: true })).json();
    expect(all.translated).toBe(2);
    expect(all.playlist.sentences[0].translationPt).toBe("PT: Hello there my friend.");

    expect((await call("POST", `/admin/playlists/${pl.id}/translate`, student, {})).statusCode).toBe(403);
  });

  it("tradução: o banco normaliza e recusa tradução vazia, mesmo escrito direto", async () => {
    const pl = await importedPlaylist();
    await pool.query("UPDATE sentences SET translation_pt = '  Olá   mundo  ' WHERE playlist_id = $1 AND position = 1", [pl.id]);
    await pool.query("UPDATE sentences SET translation_pt = '   ' WHERE playlist_id = $1 AND position = 2", [pl.id]).catch(() => undefined);
    const { rows } = await pool.query("SELECT position, translation_pt FROM sentences WHERE playlist_id = $1 AND position <= 2 ORDER BY position", [pl.id]);
    expect(rows[0].translation_pt).toBe("Olá mundo");
    expect(rows[1].translation_pt).toBeNull();
  });

  it("contadores: audições por frase (maior total vence) e playlist ouvida inteira no catálogo", async () => {
    const ctx = await makeContext();
    const pl = await makePlaylist(ctx.id);
    for (const text of ["Hello there my friend.", "See you tomorrow."]) {
      await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text });
    }
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);
    const [a, b] = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences as { id: string; listenCount: number }[];
    expect([a!.listenCount, b!.listenCount]).toEqual([0, 0]);
    const state = (listenCounts?: Record<string, number>, loopsCompleted = 0) => ({
      lastSentenceId: a!.id, loopsCompleted, listenedSeconds: 10, clientUpdatedAt: new Date().toISOString(), listenCounts,
    });

    expect((await call("PUT", `/playlists/${pl.id}/state`, student, state({ [a!.id]: 4, [b!.id]: 1 }, 2))).statusCode).toBe(200);
    // reenviar um total menor (cliente atrasado) ou o mesmo não reduz nem duplica
    await call("PUT", `/playlists/${pl.id}/state`, student, state({ [a!.id]: 3, [b!.id]: 1 }, 2));
    await call("PUT", `/playlists/${pl.id}/state`, student, state({ [b!.id]: 5 }, 2));
    const after = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences as { id: string; listenCount: number }[];
    expect(after.map((s) => s.listenCount)).toEqual([4, 5]);

    // id de outra playlist é ignorado; cliente antigo (sem listenCounts) continua válido
    const other = await makePlaylist(ctx.id, "Outra");
    await call("POST", `/admin/playlists/${other.id}/sentences`, admin, { text: "Another fine sentence." });
    const foreign = (await call("GET", `/admin/playlists/${other.id}`, admin)).json().sentences[0].id;
    expect((await call("PUT", `/playlists/${pl.id}/state`, student, state({ [foreign]: 9 }, 2))).statusCode).toBe(200);
    expect((await call("PUT", `/playlists/${pl.id}/state`, student, state(undefined, 2))).statusCode).toBe(200);
    expect((await pool.query("SELECT count(*)::int AS n FROM user_sentence_stats WHERE sentence_id = $1", [foreign])).rows[0].n).toBe(0);
    expect((await call("PUT", `/playlists/${pl.id}/state`, student, state({ "não-é-uuid": 1 }))).statusCode).toBe(400);
    expect((await call("PUT", `/playlists/${pl.id}/state`, student, state({ [a!.id]: -1 }))).statusCode).toBe(400);

    const catalog = (await call("GET", "/catalog", student)).json();
    expect(catalog.contexts[0].playlists[0].loopsCompleted).toBe(2);
    // o contador é de cada aluno
    const hash = await hashPassword("senha-boa-123");
    await pool.query("INSERT INTO users (email, name, password_hash) VALUES ('outro@t.com','Outro',$1)", [hash]);
    const outro = await login("outro@t.com", "senha-boa-123");
    expect((await call("GET", "/catalog", outro)).json().contexts[0].playlists[0].loopsCompleted).toBe(0);
    expect((await call("GET", `/playlists/${pl.id}`, outro)).json().sentences.map((s: { listenCount: number }) => s.listenCount)).toEqual([0, 0]);
  });

  it("o catálogo do aluno segue a ordem das playlists definida pelo administrador", async () => {
    const ctx = await makeContext();
    const ids: string[] = [];
    for (const title of ["Primeira", "Segunda", "Terceira"]) {
      const pl = await makePlaylist(ctx.id, title, { description: `Sobre ${title}` });
      await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: `Hello from ${title} playlist.` });
      await call("POST", `/admin/playlists/${pl.id}/publish`, admin);
      ids.push(pl.id);
    }
    const titles = async () => (await call("GET", "/catalog", student)).json().contexts[0].playlists.map((p: { title: string }) => p.title);
    expect(await titles()).toEqual(["Primeira", "Segunda", "Terceira"]);
    await call("PUT", `/admin/contexts/${ctx.id}/playlists/order`, admin, { ids: [ids[2], ids[0], ids[1]] });
    expect(await titles()).toEqual(["Terceira", "Primeira", "Segunda"]);

    const detail = (await call("GET", `/playlists/${ids[0]}`, student)).json();
    expect(detail).toMatchObject({ title: "Primeira", description: "Sobre Primeira", contextName: "Entrevista Java" });
    expect(detail).not.toHaveProperty("levelCode");
  });

  it("publicar exige frases; aluno só vê publicadas de itens ativos", async () => {
    const ctx = await makeContext();
    const pl = await playlistOf(ctx.id);
    expect((await call("POST", `/admin/playlists/${pl.id}/publish`, admin)).statusCode).toBe(409);
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend." });
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);

    const empty = await makePlaylist(ctx.id, "Vazia");
    const cat = (await call("GET", "/catalog", student)).json();
    expect(cat.contexts[0].playlists).toHaveLength(1); // rascunhos e playlists vazias não aparecem
    expect(cat.contexts[0].playlists[0]).toMatchObject({ id: pl.id, slug: "verbo-to-be", title: "verbo-to-be", sentenceCount: 1 });
    expect((await call("GET", `/playlists/${empty.id}`, student)).statusCode).toBe(404);

    await call("PUT", `/admin/contexts/${ctx.id}`, admin, { slug: "entrevista-java", name: "Entrevista Java", category: "Trabalho", active: false });
    expect((await call("GET", "/catalog", student)).json().contexts).toHaveLength(0);
    expect((await call("GET", `/playlists/${pl.id}`, student)).statusCode).toBe(404);

    await call("PUT", `/admin/contexts/${ctx.id}`, admin, { slug: "entrevista-java", name: "Entrevista Java", category: "Trabalho", active: true });
    await call("POST", `/admin/playlists/${pl.id}/unpublish`, admin);
    expect((await call("GET", "/catalog", student)).json().contexts).toHaveLength(0);
  });

  // ---------- áudio lazy, offline, estado ----------
  async function publishedExample() {
    const pl = await importedPlaylist();
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);
    return pl;
  }

  it("áudio lazy: gera uma vez, reaproveita, e single-flight sob concorrência", async () => {
    const pl = await publishedExample();
    const detail = (await call("GET", `/playlists/${pl.id}`, student)).json();
    expect(detail.sentences[0].audioUrl).toBeUndefined();
    const sid = detail.sentences[0].id;

    const results = await Promise.all(Array.from({ length: 6 }, () => call("GET", `/sentences/${sid}/audio`, student)));
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(tts.calls).toBe(1);
    const a = results[0]!.json();
    expect(a.durationMs).toBe(2612);
    expect(a.url).toMatch(/^\/audio\/[0-9a-f]{64}\.mp3$/);
    expect(await new LocalStorage(dir).exists(a.url.slice(7, -4))).toBe(true);

    await call("GET", `/sentences/${sid}/audio`, student);
    expect(tts.calls).toBe(1);
    expect((await call("GET", `/playlists/${pl.id}`, student)).json().sentences[0].audioUrl).toBe(a.url);

    const stats = (await call("GET", `/admin/playlists/${pl.id}/stats`, admin)).json();
    expect(stats.audioReady).toBe(1);
    expect(stats.ttsChars).toBeGreaterThan(0);
  });

  it("falha do TTS marca failed e a próxima requisição tenta de novo", async () => {
    const pl = await publishedExample();
    const sid = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences[0].id;
    const original = tts.synthesize.bind(tts);
    tts.synthesize = async () => { throw new Error("boom"); };
    expect((await call("GET", `/sentences/${sid}/audio`, student)).statusCode).toBe(502);
    const row = await pool.query("SELECT status, attempts FROM audios");
    expect(row.rows[0]).toMatchObject({ status: "failed", attempts: 1 });
    tts.synthesize = original;
    expect((await call("GET", `/sentences/${sid}/audio`, student)).statusCode).toBe(200);
  });

  it("prepare devolve o manifesto offline com todos os áudios", async () => {
    const pl = await publishedExample();
    const res = await call("POST", `/playlists/${pl.id}/prepare`, student);
    expect(res.statusCode).toBe(200);
    const m = res.json();
    expect(m.sentences.length).toBeGreaterThan(0);
    expect(m.sentences.every((s: { audioUrl: string; durationMs: number }) => s.audioUrl && s.durationMs > 0)).toBe(true);
    expect(tts.calls).toBe(m.sentences.length);
    expect(m.version).toBe(2); // o INSERT das frases conta como mudança de conteúdo
    expect(m).toMatchObject({ title: "verbo-to-be", contextName: "Entrevista Java" });
  });

  it("estado do aluno: salva, o mais recente vence, e o reimport zera a retomada", async () => {
    const pl = await publishedExample();
    const sentences = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences;
    const put = (lastSentenceId: string | null, loops: number, at: string) =>
      call("PUT", `/playlists/${pl.id}/state`, student, { lastSentenceId, loopsCompleted: loops, listenedSeconds: 60, clientUpdatedAt: at });

    await put(sentences[2].id, 1, "2026-10-25T10:00:00.000Z");
    await put(sentences[0].id, 0, "2026-10-25T09:00:00.000Z"); // mais antigo: ignorado
    const state = (await call("GET", `/playlists/${pl.id}`, student)).json().state;
    expect(state).toMatchObject({ lastSentenceId: sentences[2].id, loopsCompleted: 1 });

    await call("DELETE", `/admin/sentences/${sentences[2].id}`, admin);
    expect((await call("GET", `/playlists/${pl.id}`, student)).json().state.lastSentenceId).toBeNull();
  });

  it("limpeza de órfãos (CLI): remove só o áudio sem frase; prévia não remove; painel só conta; sem endpoint", async () => {
    const pl = await publishedExample();
    const [s0, s1] = (await call("GET", `/playlists/${pl.id}`, student)).json().sentences;
    await call("GET", `/sentences/${s0.id}/audio`, student);
    await call("GET", `/sentences/${s1.id}/audio`, student);
    await call("PATCH", `/admin/sentences/${s0.id}`, admin, { text: "Now this text is different." });

    expect((await call("GET", "/admin/overview", admin)).json()).toMatchObject({ playlists: { published: 1, empty: 0 }, audios: { ready: 2, orphans: 1 } });
    // o painel não tem mais como apagar áudios: o endpoint de limpeza não existe
    expect((await call("POST", "/admin/audios/cleanup-orphans?dry_run=false", admin)).statusCode).toBe(404);
    expect((await pool.query("SELECT 1 FROM audios")).rowCount).toBe(2);
    const { cleanupOrphanAudios } = await import("./modules/audio/audio-cleanup");
    const store = new LocalStorage(dir);
    expect(await cleanupOrphanAudios(pool, store, { dryRun: true })).toMatchObject({ orphanAudios: 1, removed: false });
    expect((await pool.query("SELECT 1 FROM audios")).rowCount).toBe(2);
    expect(await cleanupOrphanAudios(pool, store, { dryRun: false })).toMatchObject({ orphanAudios: 1, removed: true });
    expect((await pool.query("SELECT 1 FROM audios")).rowCount).toBe(1);
    expect((await new LocalStorage(dir).list()).length).toBe(1);
  });

  it("configurações do aluno: padrão, validação e persistência", async () => {
    expect((await call("GET", "/me/settings", student)).json()).toEqual({
      repeats: 2, speed: 1, loop: true, showTranslation: true, keepScreenOn: false,
    });
    expect((await call("PUT", "/me/settings", student, { repeats: 9, speed: 1, loop: true })).statusCode).toBe(400);
    expect((await call("PUT", "/me/settings", student, { repeats: 3, speed: 0.75, loop: false })).json()).toEqual({
      repeats: 3, speed: 0.75, loop: false, showTranslation: true, keepScreenOn: false,
    });
    expect(
      (await call("PUT", "/me/settings", student, { repeats: 3, speed: 1, loop: false, showTranslation: false, keepScreenOn: true })).json(),
    ).toEqual({ repeats: 3, speed: 1, loop: false, showTranslation: false, keepScreenOn: true });
  });
});
