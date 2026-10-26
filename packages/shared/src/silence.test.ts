import { describe, expect, it } from "vitest";
import { calcularSilencioMs } from "./silence";

describe("calcularSilencioMs", () => {
  it("10 s a 1x → 11,5 s", () => expect(calcularSilencioMs(10_000, 1)).toBe(11_500));
  it("10 s a 0,75x → ~14,8 s", () => expect(calcularSilencioMs(10_000, 0.75)).toBe(14_833));
  it("4 s a 1x → 5,5 s", () => expect(calcularSilencioMs(4_000, 1)).toBe(5_500));
  it("aceita padding customizado", () => expect(calcularSilencioMs(4_000, 1, 0)).toBe(4_000));
  it("recusa velocidade inválida", () => expect(() => calcularSilencioMs(4_000, 0)).toThrow(RangeError));
});
