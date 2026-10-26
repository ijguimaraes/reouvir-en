import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

/** Erro (com "Tentar de novo" quando há `onRetry`) ou esqueleto de carregamento. */
export function Status({ error, loading, onRetry }: { error: string; loading?: boolean; onRetry?: () => void }) {
  if (error) {
    return (
      <div role="alert">
        <p className="error">{error}</p>
        {onRetry && <button type="button" onClick={onRetry}>Tentar de novo</button>}
      </div>
    );
  }
  if (!loading) return null;
  return (
    <div role="status">
      <span className="sr-only">Carregando…</span>
      {[0, 1, 2].map((i) => <div key={i} className="skeleton" aria-hidden="true" />)}
    </div>
  );
}

/** Tabela dentro de um contêiner que rola na horizontal, para a página nunca rolar de lado. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap"><table>{children}</table></div>;
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

export interface ConfirmOptions {
  title: string;
  body?: string;
  /** Verbo da ação, no botão ("Excluir", "Redefinir senha"). */
  confirmLabel: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Confirmação em <dialog> no lugar de window.confirm: nomeia o objeto e a consequência,
 * o botão diz a ação e o foco inicial fica em "Cancelar". Renderize `dialog` no JSX.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  useEffect(() => {
    if (pending && ref.current && !ref.current.open) ref.current.showModal();
  }, [pending]);

  function close(ok: boolean) {
    ref.current?.close();
    pending?.resolve(ok);
    setPending(null);
  }

  const dialog = pending ? (
    <dialog ref={ref} aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); close(false); }}>
      <h2 id="confirm-title">{pending.title}</h2>
      {pending.body && <p className="muted">{pending.body}</p>}
      <div className="actions">
        <button type="button" autoFocus onClick={() => close(false)}>Cancelar</button>
        <button type="button" className={pending.danger ? "danger" : "primary"} onClick={() => close(true)}>
          {pending.confirmLabel}
        </button>
      </div>
    </dialog>
  ) : null;

  return [confirm, dialog];
}
