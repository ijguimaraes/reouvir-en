import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ZodError } from "zod";
import type { Config } from "./config";
import { AppError } from "./errors";
import { makeTtsIdentity } from "./modules/audio/audio-key";
import { AudioService } from "./modules/audio/audio.service";
import { ElevenLabsTts, type TtsProvider } from "./modules/audio/tts";
import { AnthropicTranslator, type Translator } from "./modules/translation/translator";
import { registerCatalogAdminRoutes } from "./modules/catalog/catalog.routes";
import { registerPlaylistAdminRoutes } from "./modules/playlists/playlists.routes";
import { registerOverviewAdminRoutes } from "./modules/playlists/overview.routes";
import { registerStudentRoutes } from "./modules/student/student.routes";
import { registerUsersAdminRoutes } from "./modules/users/users.routes";
import { LocalStorage, type Storage } from "./storage/storage";
import { createAuthenticate, requireRole } from "./modules/auth/auth.plugin";
import { registerAuthRoutes } from "./modules/auth/auth.routes";
import { AuthService } from "./modules/auth/auth.service";
import { TokenService } from "./modules/auth/tokens";

export interface AppDeps {
  config: Config;
  pool: Pool;
  /** Injetáveis para testes; por padrão: disco local e ElevenLabs. */
  storage?: Storage;
  tts?: TtsProvider;
  /** Tradutor das frases; por padrão, a API da Anthropic. */
  translator?: Translator;
}

export async function buildApp({ config, pool, storage, tts, translator }: AppDeps): Promise<FastifyInstance> {
  // Atrás do Caddy/tailscale serve: confiar no X-Forwarded-For para o IP real.
  const app = Fastify({ logger: config.NODE_ENV !== "test", trustProxy: true });

  await app.register(cookie);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "validation",
          // quem chama (inclusive o MCP) só vê a mensagem: ela precisa dizer o que está errado
          message: `Dados inválidos: ${err.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; ")}`,
          issues: err.issues,
        },
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: { code: "bad_request", message: (err as Error).message } });
    }
    app.log.error(err);
    return reply.code(500).send({ error: { code: "internal", message: "Erro interno" } });
  });

  const tokens = new TokenService(config.SESSION_SECRET);
  const authService = new AuthService(pool, tokens, {
    loginPerIp: config.AUTH_LOGIN_MAX_PER_IP,
    loginPerEmail: config.AUTH_LOGIN_MAX_PER_EMAIL,
    registerPerIp: config.AUTH_REGISTER_MAX_PER_IP,
  });
  const authenticate = createAuthenticate(tokens);

  const identity = makeTtsIdentity(config.ELEVENLABS_VOICE_ID, config.ELEVENLABS_MODEL_ID);
  const store = storage ?? new LocalStorage(config.AUDIO_DIR);
  const audio = new AudioService(
    pool,
    store,
    tts ?? new ElevenLabsTts(config.ELEVENLABS_API_KEY, identity),
    identity,
    { maxPerMinute: config.TTS_MAX_PER_MINUTE, maxPerUserPerMinute: config.TTS_MAX_PER_USER_PER_MINUTE },
  );
  // Em produção o Caddy serve /audio direto do volume; isto cobre o desenvolvimento e testes.
  if (!storage) {
    await mkdir(config.AUDIO_DIR, { recursive: true });
    await app.register(fastifyStatic, {
      root: path.resolve(config.AUDIO_DIR),
      prefix: "/audio/",
      cacheControl: true,
      maxAge: "365d",
      immutable: true,
    });
  }
  const guards = [authenticate];
  const adminGuards = [authenticate, requireRole("admin")];

  await app.register(
    async (api) => {
      api.get("/health", async () => ({ ok: true }));
      registerAuthRoutes(api, { config, service: authService, authenticate });
      registerCatalogAdminRoutes(api, { pool, guards: adminGuards });
      registerUsersAdminRoutes(api, { pool, guards: adminGuards });
      registerPlaylistAdminRoutes(api, { pool, guards: adminGuards,
        tts: identity,
        translator: translator ?? new AnthropicTranslator(config.ANTHROPIC_API_KEY, config.TRANSLATION_MODEL),
      });
      registerOverviewAdminRoutes(api, { pool, guards: adminGuards });
      registerStudentRoutes(api, { pool, guards, audio });
    },
    { prefix: "/api" },
  );

  return app;
}
