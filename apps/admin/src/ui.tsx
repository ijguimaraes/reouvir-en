import { useCallback, useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
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

/**
 * Reordenar linhas de tabela arrastando, ou digitando a posição de destino e teclando Enter.
 * Quem usa informa os ids na ordem atual e recebe, em `onReorder`, a lista completa na nova ordem.
 */
export function useReorderableRows(ids: string[], onReorder: (ids: string[]) => void) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const end = () => {
    setDragFrom(null);
    setDragOver(null);
  };
  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onReorder(next);
  }
  /** Atributos da linha (`<tr {...rowProps(i)}>`). */
  const rowProps = (i: number) => ({
    className: dragOver === i && dragFrom !== null ? "dragover" : undefined,
    draggable: true,
    onDragStart: () => setDragFrom(i),
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(i);
    },
    onDragEnd: end,
    onDrop: () => {
      if (dragFrom !== null) move(dragFrom, i);
      end();
    },
  });
  /** Atributos do campo "mover para" (`<input {...posInputProps(i)} />`). */
  const posInputProps = (i: number) => ({
    className: "pos",
    type: "number" as const,
    min: 1,
    max: ids.length,
    placeholder: String(i + 1),
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") move(i, Number(e.currentTarget.value) - 1);
    },
  });
  return { rowProps, posInputProps };
}
