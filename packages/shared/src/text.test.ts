import { describe, expect, it } from "vitest";
import { countWords, hasEmoji, hasUrl, normalizeText, slugify, wordRangeForLevel } from "./text";

describe("text", () => {
  it("normaliza espaços e aspas", () => {
    expect(normalizeText("  I’m   “ready”…  ")).toBe('I\'m "ready"...');
  });
  it("slugify tira acentos e parênteses", () => {
    expect(slugify("Entrevista de engenheiro de software (Java)")).toBe(
      "entrevista-de-engenheiro-de-software-java",
    );
    expect(slugify("Pronomes pessoais e possessivos")).toBe("pronomes-pessoais-e-possessivos");
  });
  it("detecta url e emoji", () => {
    expect(hasUrl("see https://x.com now")).toBe(true);
    expect(hasUrl("I am a Java developer.")).toBe(false);
    expect(hasEmoji("great 😀")).toBe(true);
    expect(hasEmoji("great")).toBe(false);
  });
  it("conta palavras e faixas", () => {
    expect(countWords("I am a Java developer.")).toBe(5);
    expect(wordRangeForLevel("a1")).toEqual([4, 10]);
    expect(wordRangeForLevel("X")).toBeNull();
  });
});
