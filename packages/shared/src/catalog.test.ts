import { describe, expect, it } from "vitest";
import { sentenceInputSchema, sentenceUpdateSchema } from "./catalog";

describe("schemas de frase (estritos)", () => {
  it("aceita texto, com ou sem tradução", () => {
    expect(sentenceInputSchema.parse({ text: "Hello there." })).toEqual({ text: "Hello there." });
    expect(sentenceInputSchema.parse({ text: "Hello there.", translationPt: "Olá." })).toEqual({
      text: "Hello there.", translationPt: "Olá.",
    });
  });

  it("recusa chave desconhecida em vez de descartá-la (ex.: translation_pt)", () => {
    const r = sentenceInputSchema.safeParse({ text: "Hello there.", translation_pt: "Olá." });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("translation_pt");
    expect(sentenceUpdateSchema.safeParse({ translation_pt: "Olá." }).success).toBe(false);
  });

  it("na edição, exige text ou translationPt; null apaga a tradução", () => {
    expect(sentenceUpdateSchema.safeParse({}).success).toBe(false);
    expect(sentenceUpdateSchema.parse({ translationPt: null })).toEqual({ translationPt: null });
    expect(sentenceUpdateSchema.parse({ text: "Hello there." })).toEqual({ text: "Hello there." });
  });
});
