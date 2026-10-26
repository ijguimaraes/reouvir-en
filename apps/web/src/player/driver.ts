import type { AudioDriver } from "./engine";

/** WAV mudo de 1 s (8 kHz, 8 bits), em data URI: a "faixa silenciosa" que mantém a sessão de áudio viva. */
function silentWavUri(): string {
  const samples = 8000;
  const buf = new Uint8Array(44 + samples);
  const v = new DataView(buf.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  tag(0, "RIFF"); v.setUint32(4, 36 + samples, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  tag(36, "data"); v.setUint32(40, samples, true);
  buf.fill(128, 44); // 8 bits sem sinal: 128 = silêncio
  let bin = "";
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * Um único <audio>: toca as frases e, durante o silêncio, uma faixa muda em loop. Com a sessão
 * sempre "tocando", o sistema tende a não suspender a página com a tela bloqueada. Trocar o `src`
 * com a tela bloqueada é o ponto a validar no iPhone/Android (fase 2).
 */
export class HtmlAudioDriver implements AudioDriver {
  private el = new Audio();
  private detach: (() => void) | null = null;
  private silence = silentWavUri();

  constructor() {
    this.el.preload = "auto";
  }

  get element(): HTMLAudioElement {
    return this.el;
  }

  playClip(url: string, rate: number): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      const el = this.el;
      this.release();
      el.loop = false;
      el.defaultPlaybackRate = rate; // definir antes do src: trocar o src reinicia o playbackRate
      el.src = url;
      el.playbackRate = rate;
      const onEnded = () => {
        this.release();
        resolve(Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined);
      };
      const onError = () => {
        this.release();
        reject(new Error("Falha ao carregar o áudio"));
      };
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      this.detach = () => {
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      };
      el.play().catch((err) => {
        this.release();
        reject(err);
      });
    });
  }

  holdSilence(): void {
    this.release();
    this.el.loop = true;
    this.el.defaultPlaybackRate = 1;
    this.el.src = this.silence;
    this.el.playbackRate = 1;
    void this.el.play().catch(() => undefined);
  }

  pause(): void {
    this.el.pause();
  }

  resume(): void {
    void this.el.play().catch(() => undefined);
  }

  stop(): void {
    this.release();
    this.el.pause();
  }

  private release(): void {
    this.detach?.();
    this.detach = null;
  }
}

export function bindMediaSession(
  meta: { title: string; artist: string; album: string },
  handlers: { play: () => void; pause: () => void; next: () => void; prev: () => void },
): () => void {
  if (!("mediaSession" in navigator)) return () => undefined;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({
    ...meta,
    artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  });
  ms.setActionHandler("play", handlers.play);
  ms.setActionHandler("pause", handlers.pause);
  ms.setActionHandler("nexttrack", handlers.next);
  ms.setActionHandler("previoustrack", handlers.prev);
  return () => {
    for (const a of ["play", "pause", "nexttrack", "previoustrack"] as const) ms.setActionHandler(a, null);
  };
}
