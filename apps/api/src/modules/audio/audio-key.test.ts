import { describe, expect, it } from "vitest";
import { audioKey, makeTtsIdentity, textHash } from "./audio-key";

describe("audio-key", () => {
  const id = makeTtsIdentity("v1", "m1");
  it("é estável e ignora espaços extras no texto", () => {
    expect(textHash("I  am   here.")).toBe(textHash(" I am here. "));
    expect(audioKey(textHash("a b"), id)).toBe(audioKey(textHash("a  b"), id));
  });
  it("muda com voz, modelo ou configurações", () => {
    const base = audioKey(textHash("x y z"), id);
    expect(audioKey(textHash("x y z"), makeTtsIdentity("v2", "m1"))).not.toBe(base);
    expect(audioKey(textHash("x y z"), makeTtsIdentity("v1", "m2"))).not.toBe(base);
    expect(audioKey(textHash("x y z"), makeTtsIdentity("v1", "m1", { stability: 0.1 }))).not.toBe(base);
  });
  it("a ordem das chaves das configurações não importa", () => {
    expect(makeTtsIdentity("v", "m", { a: 1, b: 2 }).settingsHash).toBe(makeTtsIdentity("v", "m", { b: 2, a: 1 }).settingsHash);
  });
});
