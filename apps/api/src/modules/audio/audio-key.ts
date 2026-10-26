import { createHash } from "node:crypto";
import { normalizeText } from "@reouvir/shared";

export interface TtsIdentity {
  voiceId: string;
  modelId: string;
  settings: Record<string, number | boolean>;
  settingsHash: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function textHash(text: string): string {
  return sha256(normalizeText(text));
}

/** Configurações de voz fixas do MVP: uma voz, um modelo. */
export const DEFAULT_VOICE_SETTINGS: Record<string, number | boolean> = { stability: 0.5, similarity_boost: 0.75 };

export function makeTtsIdentity(voiceId: string, modelId: string, settings = DEFAULT_VOICE_SETTINGS): TtsIdentity {
  const sorted = Object.fromEntries(Object.entries(settings).sort(([a], [b]) => a.localeCompare(b)));
  return { voiceId, modelId, settings, settingsHash: sha256(JSON.stringify(sorted)) };
}

/** audio_key = sha256(texto normalizado | voice_id | model_id | voice_settings), via hash do texto. */
export function audioKey(textHashValue: string, id: TtsIdentity): string {
  return sha256([textHashValue, id.voiceId, id.modelId, id.settingsHash].join("|"));
}
