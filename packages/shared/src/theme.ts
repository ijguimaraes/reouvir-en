export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "reouvir-theme";

export function getStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Aplica a escolha em <html data-theme>; "system" remove o atributo e deixa o CSS seguir o sistema. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* armazenamento indisponível: a escolha vale só nesta sessão */
  }
}

export function initTheme(): void {
  const choice = getStoredTheme();
  if (choice !== "system") document.documentElement.setAttribute("data-theme", choice);
}

/** Alterna entre claro e escuro a partir do tema efetivo atual. */
export function toggleTheme(): ThemeChoice {
  const root = document.documentElement;
  const attr = root.getAttribute("data-theme");
  const effectiveDark = attr
    ? attr === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  const next: ThemeChoice = effectiveDark ? "light" : "dark";
  applyTheme(next);
  return next;
}
