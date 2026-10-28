import { useEffect } from "react";

/** Screen Wake Lock: Safari 16.4+, Chrome e Android. Sem suporte, a opção fica desabilitada. */
export const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

/**
 * Mantém a tela ligada enquanto `active`. O navegador solta o lock sozinho quando a aba some
 * (tela bloqueada, troca de app), então pede de novo ao voltar a ficar visível.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !wakeLockSupported) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) void next.release();
        else lock = next;
      } catch {
        /* negado (economia de bateria, aba oculta): o áudio segue tocando, só a tela apaga */
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
