import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerEngine, type AudioDriver, type EngineSettings } from "./engine";

/** Driver falso: cada clipe dura `durationMs / rate` no relógio simulado. */
class FakeDriver implements AudioDriver {
  log: string[] = [];
  private resolveClip: (() => void) | null = null;
  private remaining = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private durationMs: number) {}

  playClip(url: string, rate: number): Promise<number | undefined> {
    this.log.push(`play ${url}@${rate}`);
    this.remaining = this.durationMs / rate;
    return new Promise((res) => {
      this.resolveClip = () => res(this.durationMs);
      this.arm();
    });
  }
  private arm() {
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.resolveClip?.(), this.remaining);
  }
  holdSilence() { this.log.push("silence"); }
  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.remaining -= Date.now() - this.startedAt;
    }
  }
  resume() { if (this.resolveClip && !this.timer && this.remaining > 0) this.arm(); }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.resolveClip = null; }
}

const settings = (o: Partial<EngineSettings> = {}): EngineSettings => ({ repeats: 2, speed: 1, loop: true, ...o });

function setup(opts: { length?: number; settings?: Partial<EngineSettings>; durationMs?: number; startIndex?: number } = {}) {
  const driver = new FakeDriver(opts.durationMs ?? 1000);
  const items: number[] = [];
  const loops: number[] = [];
  const engine = new PlayerEngine({
    length: opts.length ?? 2,
    resolve: async (i) => ({ url: `s${i}`, durationMs: opts.durationMs ?? 1000 }),
    driver,
    settings: settings(opts.settings),
    startIndex: opts.startIndex,
    onItem: (i) => items.push(i),
    onLoop: () => loops.push(1),
  });
  return { engine, driver, items, loops };
}

describe("PlayerEngine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("repete N vezes com silêncio de duração/velocidade + 1,5 s depois de cada audição", async () => {
    const { engine, driver } = setup();
    engine.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.state.phase).toBe("playing");
    await vi.advanceTimersByTimeAsync(1000); // fim do clipe
    expect(engine.state.phase).toBe("silence");
    expect(engine.state.silenceMs).toBe(2500);
    await vi.advanceTimersByTimeAsync(2499);
    expect(engine.state.phase).toBe("silence");
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.state.repetition).toBe(1); // segunda repetição da frase 0
    expect(driver.log).toEqual(["play s0@1", "silence", "play s0@1"]);
  });

  it("o silêncio vale depois da última repetição, antes da próxima frase", async () => {
    const { engine, driver, items } = setup({ settings: { repeats: 1 } });
    engine.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.state.index).toBe(0);
    expect(engine.state.phase).toBe("silence");
    await vi.advanceTimersByTimeAsync(2500);
    expect(engine.state.index).toBe(1);
    expect(items).toEqual([0, 1]);
    expect(driver.log.at(-1)).toBe("play s1@1");
  });

  it("a 0,75x o clipe e o silêncio crescem", async () => {
    const { engine } = setup({ settings: { speed: 0.75 }, durationMs: 3000 });
    engine.play();
    await vi.advanceTimersByTimeAsync(4000); // 3000 / 0,75
    expect(engine.state.phase).toBe("silence");
    expect(engine.state.silenceMs).toBe(5500); // 4000 + 1500
  });

  it("pausar no silêncio congela a contagem e retomar continua de onde parou", async () => {
    const { engine } = setup();
    engine.play();
    await vi.advanceTimersByTimeAsync(1000 + 1000); // clipe + 1 s de silêncio
    engine.pause();
    expect(engine.state.silenceRemainingMs).toBe(1500);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.state.phase).toBe("silence");
    engine.play();
    await vi.advanceTimersByTimeAsync(1499);
    expect(engine.state.repetition).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.state.repetition).toBe(1);
  });

  it("pausar no meio do clipe e retomar termina o clipe", async () => {
    const { engine } = setup();
    engine.play();
    await vi.advanceTimersByTimeAsync(400);
    engine.pause();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(engine.state.phase).toBe("playing");
    engine.play();
    await vi.advanceTimersByTimeAsync(600);
    expect(engine.state.phase).toBe("silence");
  });

  it("próxima frase interrompe o silêncio em curso", async () => {
    const { engine, driver } = setup();
    engine.play();
    await vi.advanceTimersByTimeAsync(1500);
    expect(engine.state.phase).toBe("silence");
    engine.next();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.state.index).toBe(1);
    expect(engine.state.repetition).toBe(0);
    expect(driver.log.at(-1)).toBe("play s1@1");
    // o timer do silêncio antigo (que dispararia em 1 s) não pode reiniciar a frase 0
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.state).toMatchObject({ index: 1, phase: "silence", repetition: 0 });
    expect(driver.log.filter((l) => l === "play s0@1")).toHaveLength(1);
  });

  it("ao fim volta à posição 1 e conta uma volta (loop)", async () => {
    const { engine, loops } = setup({ settings: { repeats: 1 } });
    engine.play();
    await vi.advanceTimersByTimeAsync(3500 * 2);
    expect(engine.state.index).toBe(0);
    expect(engine.state.loops).toBe(1);
    expect(loops).toHaveLength(1);
  });

  it("sem loop, para no fim e volta ao início", async () => {
    const { engine } = setup({ settings: { repeats: 1, loop: false } });
    engine.play();
    await vi.advanceTimersByTimeAsync(3500 * 2);
    expect(engine.state).toMatchObject({ phase: "stopped", paused: true, index: 0, loops: 0 });
  });

  it("começa do ponto salvo e acumula o tempo ouvido sem contar a pausa", async () => {
    const { engine, items } = setup({ length: 5, startIndex: 3 });
    expect(engine.state.index).toBe(3);
    engine.play();
    await vi.advanceTimersByTimeAsync(2000);
    engine.pause();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(engine.getListenedMs()).toBe(2000);
    expect(items).toEqual([3]);
  });

  it("prev e seek respeitam os limites", async () => {
    const { engine } = setup({ length: 3 });
    engine.prev();
    expect(engine.state.index).toBe(0);
    engine.seek(99);
    expect(engine.state.index).toBe(2);
  });
});
