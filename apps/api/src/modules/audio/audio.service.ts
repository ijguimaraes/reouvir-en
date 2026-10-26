import type { Pool } from "pg";
import type { AudioInfoDto } from "@reouvir/shared";
import { AppError } from "../../errors";
import type { Storage } from "../../storage/storage";
import { RateLimiter } from "../auth/rate-limiter";
import { audioKey, textHash, type TtsIdentity } from "./audio-key";
import { mp3DurationMs } from "./mp3";
import type { TtsProvider } from "./tts";

interface AudioRow {
  audio_key: string; status: "pending" | "ready" | "failed"; storage_key: string | null;
  duration_ms: number | null; attempts: number; stale: boolean;
}

const MAX_ATTEMPTS = 3;
const STALE_PENDING_SECONDS = 90;
const WAIT_TIMEOUT_MS = 60_000;
const POLL_MS = 250;

export interface AudioServiceOptions {
  maxPerMinute: number;
  maxPerUserPerMinute: number;
}

export class AudioService {
  private global: RateLimiter;
  private perUser: RateLimiter;

  constructor(
    private pool: Pool,
    private storage: Storage,
    private tts: TtsProvider,
    private identity: TtsIdentity,
    opts: AudioServiceOptions,
  ) {
    this.global = new RateLimiter(opts.maxPerMinute, 60_000);
    this.perUser = new RateLimiter(opts.maxPerUserPerMinute, 60_000);
  }

  private info(row: AudioRow): AudioInfoDto {
    return { url: this.storage.url(row.storage_key ?? row.audio_key), durationMs: row.duration_ms ?? 0 };
  }

  private async find(key: string): Promise<AudioRow | null> {
    const { rows } = await this.pool.query<AudioRow>(
      `SELECT audio_key, status, storage_key, duration_ms, attempts,
              (updated_at < now() - make_interval(secs => $2)) AS stale
         FROM audios WHERE audio_key = $1`,
      [key, STALE_PENDING_SECONDS],
    );
    return rows[0] ?? null;
  }

  /** Só consulta: devolve o áudio se já estiver pronto (custo zero). */
  async lookup(text: string): Promise<AudioInfoDto | null> {
    const row = await this.find(audioKey(textHash(text), this.identity));
    return row?.status === "ready" ? this.info(row) : null;
  }

  /** Garante o áudio da frase (lazy, single-flight por UNIQUE(audio_key)). */
  async ensure(text: string, userId: string): Promise<AudioInfoDto> {
    const hash = textHash(text);
    const key = audioKey(hash, this.identity);
    const deadline = Date.now() + WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const row = await this.find(key);
      if (row?.status === "ready") return this.info(row);

      if (row?.status === "pending" && !row.stale) {
        await sleep(POLL_MS); // outro pedido está gerando: espera
        continue;
      }
      if (row?.status === "failed" && row.attempts >= MAX_ATTEMPTS) {
        throw new AppError(502, "Não foi possível gerar o áudio dessa frase", "tts_failed");
      }
      this.checkLimits(userId); // antes de reivindicar: nada fica preso em "pending"
      if (!(await this.tryClaim(key, hash, text, row))) continue; // perdeu a disputa
      return this.generate(key, text);
    }
    throw new AppError(504, "Tempo esgotado esperando o áudio", "tts_timeout");
  }

  /** O UNIQUE(audio_key) decide quem gera. Devolve true para o vencedor. */
  private async tryClaim(key: string, hash: string, text: string, row: AudioRow | null): Promise<boolean> {
    if (!row) {
      const r = await this.pool.query(
        `INSERT INTO audios (audio_key, text_hash, voice_id, model_id, settings_hash, char_count, status, attempts)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',1) ON CONFLICT (audio_key) DO NOTHING`,
        [key, hash, this.identity.voiceId, this.identity.modelId, this.identity.settingsHash, text.length],
      );
      return (r.rowCount ?? 0) > 0;
    }
    // nova tentativa de uma falha, ou retomada de um "pending" que ficou preso
    const r = await this.pool.query(
      `UPDATE audios SET status = 'pending', attempts = attempts + 1, error = NULL, updated_at = now()
        WHERE audio_key = $1 AND attempts < $2
          AND (status = 'failed' OR (status = 'pending' AND updated_at < now() - make_interval(secs => $3)))`,
      [key, MAX_ATTEMPTS, STALE_PENDING_SECONDS],
    );
    return (r.rowCount ?? 0) > 0;
  }

  private checkLimits(userId: string): void {
    if (!this.global.hit("all") || !this.perUser.hit(userId)) {
      throw new AppError(429, "Limite de geração de áudio atingido. Tente novamente em instantes.", "rate_limited");
    }
  }

  private async generate(key: string, text: string): Promise<AudioInfoDto> {
    try {
      const mp3 = await this.tts.synthesize(text);
      const duration = mp3DurationMs(mp3);
      if (!duration) throw new Error("MP3 inválido recebido do TTS");
      await this.storage.put(key, mp3);
      const { rows } = await this.pool.query<AudioRow>(
        `UPDATE audios SET status='ready', storage_key=$2, duration_ms=$3, error=NULL, updated_at=now()
          WHERE audio_key=$1 RETURNING audio_key, status, storage_key, duration_ms, attempts, false AS stale`,
        [key, key, duration],
      );
      return this.info(rows[0]!);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.pool.query(
        "UPDATE audios SET status='failed', error=$2, updated_at=now() WHERE audio_key=$1",
        [key, message.slice(0, 500)],
      );
      if (err instanceof AppError) throw err;
      throw new AppError(502, "Falha ao gerar o áudio", "tts_failed");
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
