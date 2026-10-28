import { AppError } from "../../errors";

export interface TranslateRequest {
  /** Contexto e playlist ajudam a escolher o registro (ex.: entrevista de emprego). */
  context: string;
  playlist: string;
  sentences: string[];
}

export interface Translator {
  /** Uma tradução por frase, na mesma ordem. */
  translate(req: TranslateRequest): Promise<string[]>;
}

const TOOL = "save_translations";

export class AnthropicTranslator implements Translator {
  constructor(private apiKey: string | undefined, private model: string) {}

  async translate({ context, playlist, sentences }: TranslateRequest): Promise<string[]> {
    if (!this.apiKey) throw new AppError(503, "ANTHROPIC_API_KEY não configurada", "translation_unconfigured");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system:
          "Você traduz frases de inglês para português do Brasil para um app de treino de escuta. " +
          "Traduza o sentido de forma natural, no registro da frase, sem explicações, sem notas e sem aspas extras. " +
          "Devolva exatamente uma tradução por frase, na mesma ordem.",
        messages: [
          {
            role: "user",
            content:
              `Contexto: ${context}\nPlaylist: ${playlist}\n\nFrases:\n` +
              sentences.map((s, i) => `${i + 1}. ${s}`).join("\n"),
          },
        ],
        tools: [
          {
            name: TOOL,
            description: "Salva as traduções, uma por frase, na ordem recebida.",
            input_schema: {
              type: "object",
              properties: { translations: { type: "array", items: { type: "string" } } },
              required: ["translations"],
            },
          },
        ],
        tool_choice: { type: "tool", name: TOOL },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Anthropic respondeu ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as { content?: { type: string; input?: { translations?: unknown } }[] };
    const out = body.content?.find((b) => b.type === "tool_use")?.input?.translations;
    if (!Array.isArray(out) || out.length !== sentences.length || !out.every((t) => typeof t === "string" && t.trim())) {
      throw new Error("A tradução voltou fora do formato esperado (quantidade ou texto vazio)");
    }
    return out as string[];
  }
}
