import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@reouvir/api-client";

export const errMsg = (e: unknown): string => (e instanceof ApiError ? e.message : "Falha de conexão");

/** Carrega dados e permite recarregar. `load` deve ser estável entre renders (useCallback). */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && (setData(d), setError("")))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [load, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}

export function Status({ error, loading }: { error: string; loading?: boolean }) {
  if (error) return <p className="error">{error}</p>;
  return loading ? <p className="muted">Carregando…</p> : null;
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "rascunho", published: "publicada", archived: "arquivada",
  done: "concluída", partial: "parcial", failed: "falhou",
  create: "criar", replace: "substituir", unchanged: "sem mudanças", refused: "recusada", error: "erro",
  active: "ativo", blocked: "bloqueado",
};
