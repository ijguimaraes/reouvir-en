/** Folga somada ao silêncio depois de cada audição (seção 6 do documento). */
export const SILENCE_PADDING_MS = 1500;

export const SPEEDS = [0.75, 1] as const;
export type Speed = (typeof SPEEDS)[number];

export const REPEATS_MIN = 1;
export const REPEATS_MAX = 5;
export const REPEATS_DEFAULT = 2;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const ROLES = ["student", "admin"] as const;
export type Role = (typeof ROLES)[number];
