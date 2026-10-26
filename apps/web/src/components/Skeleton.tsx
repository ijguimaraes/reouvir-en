/** Esqueleto de lista enquanto carrega; o leitor de tela ouve "Carregando…" uma vez. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" aria-hidden="true" />)}
    </div>
  );
}

/** Mensagem de erro com ação para tentar de novo. */
export function RetryError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert">
      <p className="error">{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}
