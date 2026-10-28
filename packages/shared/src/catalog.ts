import { z } from "zod";

export const slugSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido");

export const contextInputSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(""),
  details: z.string().trim().max(20000).default(""),
  category: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
});
export type ContextInput = z.infer<typeof contextInputSchema>;

export const settingsSchema = z.object({
  repeats: z.number().int().min(1).max(5),
  speed: z.union([z.literal(0.75), z.literal(1)]),
  loop: z.boolean(),
  /** Mostra a tradução em português abaixo da frase. */
  showTranslation: z.boolean().default(true),
  /** Mantém a tela do celular ligada enquanto a playlist toca (Screen Wake Lock). */
  keepScreenOn: z.boolean().default(false),
});
export type PlayerSettings = z.infer<typeof settingsSchema>;

export const playlistStatusSchema = z.enum(["draft", "published", "archived"]);
export type PlaylistStatus = z.infer<typeof playlistStatusSchema>;

/** Criar playlist: sem `slug`, o servidor o gera do título (e desempata dentro do contexto). */
export const playlistInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  description: z.string().trim().max(1000).default(""),
});
export type PlaylistInput = z.infer<typeof playlistInputSchema>;

/** Editar playlist: só os campos enviados mudam (sem `default`, para não apagar a descrição sem querer). */
export const playlistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().max(1000).optional(),
});
export type PlaylistUpdate = z.infer<typeof playlistUpdateSchema>;

export const sentenceTextSchema = z.object({ text: z.string().min(1).max(500) });

/** Tradução da frase para o português. Não passa pelas regras de texto do inglês (aceita acento e dígito). */
export const translationPtSchema = z.string().trim().min(1).max(1000);

/** Criar frase: a tradução é opcional e pode vir junto. */
export const sentenceInputSchema = sentenceTextSchema.extend({ translationPt: translationPtSchema.nullish() });
export type SentenceInput = z.infer<typeof sentenceInputSchema>;

/** Editar frase: só o que vier muda; `translationPt: null` apaga a tradução. */
export const sentenceUpdateSchema = z
  .object({
    text: sentenceTextSchema.shape.text.optional(),
    translationPt: translationPtSchema.nullable().optional(),
  })
  .refine((v) => v.text !== undefined || v.translationPt !== undefined, "Informe text ou translationPt");
export type SentenceUpdate = z.infer<typeof sentenceUpdateSchema>;

export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export const playerStateSchema = z.object({
  lastSentenceId: z.string().uuid().nullable(),
  loopsCompleted: z.number().int().min(0),
  listenedSeconds: z.number().int().min(0),
  clientUpdatedAt: z.string().datetime(),
});
export type PlayerState = z.infer<typeof playerStateSchema>;
