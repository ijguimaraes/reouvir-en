import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().default(3711),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa ter ao menos 32 caracteres"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  ANTHROPIC_API_KEY: z.string().optional(),
  TRANSLATION_MODEL: z.string().default("claude-haiku-5-5"),
  AUDIO_DIR: z.string().default("./audio-data"),
  /** Limite de gerações de áudio por minuto, no total e por aluno (seção 16). */
  TTS_MAX_PER_MINUTE: z.coerce.number().int().default(60),
  TTS_MAX_PER_USER_PER_MINUTE: z.coerce.number().int().default(40),
  /** Limites de tentativas (janela de 15 min no login; 1 h no cadastro). */
  AUTH_LOGIN_MAX_PER_IP: z.coerce.number().int().default(30),
  AUTH_LOGIN_MAX_PER_EMAIL: z.coerce.number().int().default(8),
  AUTH_REGISTER_MAX_PER_IP: z.coerce.number().int().default(10),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}
