/** Padroniza espaços, aspas e reticências antes do hash e da validação. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function hasUrl(text: string): boolean {
  return /(https?:\/\/|www\.)\S+/i.test(text) || /\b[a-z0-9-]+\.(com|org|net|io|dev|br)\b/i.test(text);
}

export function hasEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text);
}

/** Faixa de palavras por frase, por nível (seção 8.3). Outros rótulos não têm faixa. */
export function wordRangeForLevel(code: string): [number, number] | null {
  switch (code.toUpperCase()) {
    case "A1":
    case "A2":
      return [4, 10];
    case "B1":
    case "B2":
      return [8, 18];
    case "C1":
    case "C2":
      return [12, 30];
    default:
      return null;
  }
}

export interface SentenceCheck {
  errors: string[];
  warnings: string[];
}

/** Regras de conteúdo de uma frase (seção 8.3). `text` já deve estar normalizado. */
export function checkSentenceText(text: string, levelCode?: string): SentenceCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!text) {
    errors.push("texto vazio");
    return { errors, warnings };
  }
  if (hasUrl(text)) errors.push("contém URL");
  if (hasEmoji(text)) errors.push("contém emoji");
  const range = levelCode ? wordRangeForLevel(levelCode) : null;
  if (range) {
    const n = countWords(text);
    if (n < range[0] || n > range[1]) warnings.push(`${n} palavras (faixa do nível ${levelCode}: ${range[0]}–${range[1]})`);
  }
  return { errors, warnings };
}
