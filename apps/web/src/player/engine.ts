import { calcularSilencioMs } from "@reouvir/shared";

export interface AudioDriver {
  /** Toca o clipe e resolve quando termina, com a duração real medida (ms), se conhecida. */
  playClip(url: string, rate: number): Promise<number | undefined>;
  /** Mantém a sessão de áudio ativa durante o silêncio (faixa silenciosa em loop). */
  holdSilence(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface ItemAudio { url: string; durationMs: number }

export interface EngineSettings { repeats: number; speed: number; loop: boolean }

export type Phase = "stopped" | "loading" | "playing" | "silence";

export interface EngineState {
  index: number;
  /** Repetição atual, de 0 a repeats-1. */
  repetition: number;
  phase: Phase;
  paused: boolean;
  /** Duração total do silêncio em curso e quando ele começou (para a barra de progresso). */
  silenceMs: number;
  silenceRemainingMs: number;
  loops: number;
}

export interface EngineOptions {
  length: number;
  resolve: (index: number) => Promise<ItemAudio>;
  driver: AudioDriver;
  settings: EngineSettings;
  startIndex?: number;
  now?: () => number;
  onChange?: (s: EngineState) => void;
  /** Disparado ao entrar numa frase (primeira repetição), para salvar a posição. */
  onItem?: (index: number) => void;
  /** Disparado quando uma audição termina de tocar (pular ou interromper não conta). */
  onListen?: (index: number) => void;
  /** Disparado quando a última frase termina: a playlist foi ouvida inteira (com ou sem loop). */
  onLoop?: () => void;
  onError?: (e: unknown) => void;
}

/**
 * Motor da playlist (seção 6): para cada frase, repete N vezes; depois de cada audição espera
 * `duração ÷ velocidade + 1,5 s`. Pausar durante o silêncio congela a contagem.
 */
export class PlayerEngine {
  private index: number;
  private repetition = 0;
  private phase: Phase = "stopped";
  private paused = true;
  private loops = 0;
  private gen = 0;
  private silenceMs = 0;
  private silenceRemaining = 0;
  private silenceStartedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listened = 0;
  private activeSince: number | null = null;
  private settings: EngineSettings;
  private now: () => number;

  constructor(private opts: EngineOptions) {
    this.index = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(opts.length - 1, 0));
    this.settings = opts.settings;
    this.now = opts.now ?? Date.now;
  }

  get state(): EngineState {
    const remaining =
      this.phase === "silence" && !this.paused && this.timer
        ? Math.max(this.silenceRemaining - (this.now() - this.silenceStartedAt), 0)
        : this.silenceRemaining;
    return {
      index: this.index, repetition: this.repetition, phase: this.phase, paused: this.paused,
      silenceMs: this.silenceMs, silenceRemainingMs: remaining, loops: this.loops,
    };
  }

  getListenedMs(): number {
    this.tickListened();
    return this.listened;
  }

  updateSettings(s: EngineSettings): void {
    this.settings = s;
    this.emit();
  }

  play(): void {
    if (!this.paused && this.phase !== "stopped") return;
    this.paused = false;
    this.activeSince = this.now();
    switch (this.phase) {
      case "stopped": void this.startClip(); break;
      case "playing": this.opts.driver.resume(); break;
      case "silence": this.opts.driver.resume(); this.armSilence(this.silenceRemaining); break;
      case "loading": break; // o carregamento em curso segue sozinho
    }
    this.emit();
  }

  pause(): void {
    if (this.paused) return;
    this.tickListened();
    this.activeSince = null;
    this.paused = true;
    if (this.phase === "silence" && this.timer) {
      this.silenceRemaining = Math.max(this.silenceRemaining - (this.now() - this.silenceStartedAt), 0);
      this.clearTimer();
    }
    if (this.phase === "playing" || this.phase === "silence") this.opts.driver.pause();
    this.emit();
  }

  toggle(): void {
    if (this.paused) this.play();
    else this.pause();
  }

  next(): void {
    const last = this.index + 1 >= this.opts.length;
    if (last && !this.settings.loop) return;
    this.jump(last ? 0 : this.index + 1);
  }

  prev(): void {
    this.jump(Math.max(this.index - 1, 0));
  }

  seek(index: number): void {
    this.jump(Math.min(Math.max(index, 0), this.opts.length - 1));
  }

  destroy(): void {
    this.gen++;
    this.clearTimer();
    this.opts.driver.stop();
  }

  // ---- internos ----

  /** Interrompe o que estiver tocando ou esperando (inclusive o silêncio) e vai para a frase. Pular não conta como ouvir. */
  private jump(index: number): void {
    this.gen++;
    this.clearTimer();
    this.opts.driver.stop();
    this.index = index;
    this.repetition = 0;
    this.silenceMs = 0;
    this.silenceRemaining = 0;
    this.phase = "stopped";
    this.opts.onItem?.(index);
    if (!this.paused) void this.startClip();
    this.emit();
  }

  private async startClip(): Promise<void> {
    const gen = ++this.gen;
    this.phase = "loading";
    this.emit();
    let audio: ItemAudio;
    try {
      audio = await this.opts.resolve(this.index);
    } catch (err) {
      if (gen !== this.gen) return;
      this.fail(err);
      return;
    }
    if (gen !== this.gen) return;
    if (this.paused) {
      this.phase = "stopped"; // pausou enquanto carregava: play() recomeça a frase
      this.emit();
      return;
    }
    this.phase = "playing";
    if (this.repetition === 0) this.opts.onItem?.(this.index);
    this.emit();

    let actualMs: number | undefined;
    try {
      actualMs = await this.opts.driver.playClip(audio.url, this.settings.speed);
    } catch (err) {
      if (gen !== this.gen) return;
      this.fail(err);
      return;
    }
    if (gen !== this.gen) return;
    this.opts.onListen?.(this.index);
    this.startSilence(actualMs && actualMs > 0 ? actualMs : audio.durationMs);
  }

  private startSilence(durationMs: number): void {
    this.silenceMs = calcularSilencioMs(durationMs, this.settings.speed);
    this.silenceRemaining = this.silenceMs;
    this.phase = "silence";
    this.opts.driver.holdSilence();
    this.armSilence(this.silenceMs);
    this.emit();
  }

  private armSilence(ms: number): void {
    this.clearTimer();
    this.silenceStartedAt = this.now();
    const gen = this.gen;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (gen === this.gen) this.endSilence();
    }, ms);
  }

  private endSilence(): void {
    this.silenceRemaining = 0;
    if (this.repetition + 1 < this.settings.repeats) {
      this.repetition++;
      void this.startClip();
      return;
    }
    this.repetition = 0;
    if (this.index + 1 < this.opts.length) {
      this.index++;
    } else if (this.settings.loop) {
      this.index = 0;
      this.loops++;
      this.opts.onLoop?.();
    } else {
      this.loops++;
      this.opts.onLoop?.();
      this.opts.driver.stop();
      this.phase = "stopped";
      this.paused = true;
      this.tickListened();
      this.activeSince = null;
      this.index = 0;
      this.emit();
      return;
    }
    void this.startClip();
  }

  private fail(err: unknown): void {
    this.pause();
    this.phase = "stopped";
    this.opts.onError?.(err);
    this.emit();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tickListened(): void {
    if (this.activeSince === null) return;
    const t = this.now();
    this.listened += t - this.activeSince;
    this.activeSince = t;
  }

  private emit(): void {
    this.opts.onChange?.(this.state);
  }
}
