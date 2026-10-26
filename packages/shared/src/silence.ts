import { SILENCE_PADDING_MS } from "./constants";

/**
 * silêncio = duração do áudio ÷ velocidade + padding.
 * Ex.: 10 s a 0,75x → 14.833 ms.
 */
export function calcularSilencioMs(
  durationMs: number,
  speed: number,
  paddingMs: number = SILENCE_PADDING_MS,
): number {
  if (!(speed > 0)) throw new RangeError("speed deve ser maior que zero");
  return Math.round(durationMs / speed + paddingMs);
}
