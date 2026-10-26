import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("bloqueia depois do máximo e libera depois da janela", () => {
    let t = 0;
    const limiter = new RateLimiter(2, 1000, () => t);
    expect(limiter.hit("a")).toBe(true);
    expect(limiter.hit("a")).toBe(true);
    expect(limiter.hit("a")).toBe(false);
    expect(limiter.hit("b")).toBe(true);
    t = 1001;
    expect(limiter.hit("a")).toBe(true);
  });

  it("reset zera a contagem", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.hit("a");
    limiter.reset("a");
    expect(limiter.hit("a")).toBe(true);
  });
});
