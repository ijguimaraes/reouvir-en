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

describe.skipIf(!url)("admin + aluno (integração)", () => {
  const pool = createPool(url ?? "postgres://invalid");
  const tts = new FakeTts();
  let app: FastifyInstance;
  let dir: string;
  let admin: Record<string, string>;
  let student: Record<string, string>;
  let studentId: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "reouvir-audio-"));
    app = await buildApp({ config: testConfig(url!, { AUTH_LOGIN_MAX_PER_IP: "10000", AUTH_LOGIN_MAX_PER_EMAIL: "10000" }), pool, storage: new LocalStorage(dir), tts });
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
    await pool.query("TRUNCATE users, levels, contexts, audios CASCADE");
    // níveis e tópicos são fixos (vêm do seed): aqui entram direto no banco
    await pool.query(`INSERT INTO levels (code, name, sort_order) VALUES ('A1','A1',1), ('A2','A2',2)`);
    await pool.query(
      `INSERT INTO grammar_topics (level_id, slug, name, sort_order, active)
       SELECT l.id, v.slug, v.name, v.ord, v.active
         FROM (VALUES ('A1','verbo-to-be','Verbo to be',1,true),
                      ('A1','pronomes-pessoais-e-possessivos','Pronomes pessoais e possessivos',2,true),
                      ('A2','past-simple','Past Simple',1,true),
                      ('A2','topico-inativo','Tópico inativo',2,false)) AS v(lvl, slug, name, ord, active)
         JOIN levels l ON l.code = v.lvl`,
    );
    tts.calls = 0;
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
    expect((await call("GET", "/admin/levels", student)).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/admin/levels" })).statusCode).toBe(401);
  });

  async function makeContext(slug = "entrevista-java") {
    const res = await call("POST", "/admin/contexts", admin, { slug, name: "Entrevista Java", category: "Trabalho", description: "d" });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string };
  }
  async function playlistsOf(contextId: string) {
    return (await call("GET", `/admin/playlists?contextId=${contextId}`, admin)).json() as {
      id: string; topicSlug: string; levelCode: string; status: string; sentenceCount: number; version: number; topicName: string;
    }[];
  }
  const playlistOf = async (contextId: string, slug = "verbo-to-be") => (await playlistsOf(contextId)).find((p) => p.topicSlug === slug)!;

  it("níveis e tópicos são somente leitura", async () => {
    expect((await call("GET", "/admin/levels", admin)).json()).toHaveLength(2);
    expect((await call("GET", "/admin/topics", admin)).json()).toHaveLength(4);
    for (const [method, url] of [["POST", "/admin/levels"], ["PUT", "/admin/levels/x"], ["DELETE", "/admin/levels/x"], ["POST", "/admin/topics"], ["DELETE", "/admin/topics/x"]] as const) {
      expect((await call(method, url, admin, {})).statusCode).toBe(404);
    }
  });

  it("criar um contexto gera uma playlist vazia por tópico ativo, em ordem de currículo", async () => {
    const ctx = await makeContext();
    const lists = await playlistsOf(ctx.id);
    expect(lists.map((p) => p.topicSlug)).toEqual(["verbo-to-be", "pronomes-pessoais-e-possessivos", "past-simple"]);
    expect(lists.every((p) => p.status === "draft" && p.sentenceCount === 0)).toBe(true);
    expect((await call("POST", "/admin/contexts", admin, { slug: "entrevista-java", name: "x", category: "y" })).statusCode).toBe(409);
    expect((await call("GET", "/admin/playlists", admin)).json()).toHaveLength(3); // o 409 não deixou playlists sobrando
  });

  it("excluir contexto apaga as playlists vazias, mas recusa se alguma tiver frases", async () => {
    const empty = await makeContext("vazio");
    expect((await call("DELETE", `/admin/contexts/${empty.id}`, admin)).statusCode).toBe(204);
    expect((await pool.query("SELECT 1 FROM playlists")).rowCount).toBe(0);

    const used = await makeContext("usado");
    const pl = await playlistOf(used.id);
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend." });
    const res = await call("DELETE", `/admin/contexts/${used.id}`, admin);
    expect(res.statusCode).toBe(409);
    expect((await call("GET", "/admin/playlists", admin)).json()).toHaveLength(3); // nada foi apagado
    expect((await call("DELETE", "/admin/contexts/00000000-0000-0000-0000-000000000000", admin)).statusCode).toBe(404);
  });

  it("ensurePlaylists gera as playlists que faltam sem duplicar", async () => {
    const ctx = await makeContext();
    await pool.query("DELETE FROM playlists WHERE context_id = $1", [ctx.id]);
    const { CatalogRepository } = await import("./modules/catalog/catalog.repository");
    expect(await new CatalogRepository(pool).ensurePlaylists()).toBe(3);
    expect(await new CatalogRepository(pool).ensurePlaylists()).toBe(0);
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
  /** Contexto novo com a playlist "verbo-to-be" preenchida pela "pipeline" (rascunho). */
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

  it("pipeline: tópico inserido direto no banco ganha playlist vazia em todos os contextos", async () => {
    const a = await makeContext("ctx-a");
    const b = await makeContext("ctx-b");
    await pool.query(
      `INSERT INTO grammar_topics (level_id, slug, name, sort_order)
       SELECT id, 'topico-novo', 'Tópico novo', 9 FROM levels WHERE code = 'A1'`,
    );
    for (const ctx of [a, b]) {
      const found = (await playlistsOf(ctx.id)).find((p) => p.topicSlug === "topico-novo");
      expect(found).toMatchObject({ status: "draft", sentenceCount: 0 });
    }
    // reativar um tópico inativo também gera as playlists que faltam
    await pool.query("UPDATE grammar_topics SET active = true WHERE slug = 'topico-inativo'");
    expect((await playlistsOf(a.id)).map((p) => p.topicSlug)).toContain("topico-inativo");
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

  it("publicar exige frases; aluno só vê publicadas de itens ativos", async () => {
    const ctx = await makeContext();
    const pl = await playlistOf(ctx.id);
    expect((await call("POST", `/admin/playlists/${pl.id}/publish`, admin)).statusCode).toBe(409);
    await call("POST", `/admin/playlists/${pl.id}/sentences`, admin, { text: "Hello there my friend." });
    await call("POST", `/admin/playlists/${pl.id}/publish`, admin);

    let cat = (await call("GET", "/catalog", student)).json();
    expect(cat.contexts[0].levels[0].topics[0].playlistId).toBe(pl.id);
    expect(cat.contexts[0].levels[0].topics).toHaveLength(1); // as playlists vazias não aparecem

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

    expect((await call("GET", "/admin/overview", admin)).json()).toMatchObject({ playlists: { published: 1, empty: 2 }, audios: { ready: 2, orphans: 1 } });
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
    expect((await call("GET", "/me/settings", student)).json()).toEqual({ repeats: 2, speed: 1, loop: true });
    expect((await call("PUT", "/me/settings", student, { repeats: 9, speed: 1, loop: true })).statusCode).toBe(400);
    expect((await call("PUT", "/me/settings", student, { repeats: 3, speed: 0.75, loop: false })).json()).toEqual({ repeats: 3, speed: 0.75, loop: false });
  });
});
