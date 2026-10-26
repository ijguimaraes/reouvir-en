import type { PlayerSettings } from "@reouvir/shared";
import { api } from "../api";

const KEY = "reouvir-settings";
export const DEFAULT_SETTINGS: PlayerSettings = { repeats: 2, speed: 1, loop: true };

export function cachedSettings(): PlayerSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Servidor primeiro; sem rede, vale a cópia local. */
export async function loadSettings(): Promise<PlayerSettings> {
  try {
    const s = await api.request<PlayerSettings>("GET", "/me/settings");
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  } catch {
    return cachedSettings();
  }
}

export async function persistSettings(s: PlayerSettings): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem localStorage: a escolha vale só nesta sessão */
  }
  await api.request("PUT", "/me/settings", s).catch(() => undefined);
}
