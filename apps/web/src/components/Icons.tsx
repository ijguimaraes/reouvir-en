import type { ReactNode } from "react";

/** Ícones desenhados em SVG: mesmo traço (2) e mesma grade (24), cor herdada de `currentColor`. */
function Icon({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconBack = () => <Icon><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Icon>;
export const IconTheme = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></Icon>;
export const IconPrev = () => <Icon><path d="M19 20 9 12l10-8z" fill="currentColor" /><path d="M5 19V5" /></Icon>;
export const IconNext = () => <Icon><path d="m5 4 10 8-10 8z" fill="currentColor" /><path d="M19 5v14" /></Icon>;
export const IconPlay = () => <Icon size={32}><path d="m7 4 13 8-13 8z" fill="currentColor" /></Icon>;
export const IconPause = () => <Icon size={32}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" /></Icon>;
