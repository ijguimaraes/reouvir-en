import { useCallback, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDto, ContextDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, TableWrap, useConfirm, useLoad, useReorderableRows } from "../ui";

interface Draft { title: string; slug: string; description: string }

/** Playlists do contexto: o administrador cria, renomeia, ordena e exclui; as frases ficam na tela de cada playlist. */
export function ContextDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(async () => {
    const [contexts, playlists] = await Promise.all([
      api.request<ContextDto[]>("GET", "/admin/contexts"),
      api.request<AdminPlaylistDto[]>("GET", `/admin/playlists?contextId=${id}`),
    ]);
    return { context: contexts.find((c) => c.id === id) ?? null, playlists };
  }, [id]);
  const { data, error, reload, setData } = useLoad(load);
  const [actionError, setActionError] = useState("");
  const [created, setCreated] = useState({ title: "", description: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", slug: "", description: "" });
  const [confirm, confirmDialog] = useConfirm();

  async function run(fn: () => Promise<unknown>) {
    setActionError("");
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(errMsg(err));
    }
  }

  async function reorder(ids: string[]) {
    setActionError("");
    try {
      const playlists = await api.request<AdminPlaylistDto[]>("PUT", `/admin/contexts/${id}/playlists/order`, { ids });
      setData((cur) => (cur ? { ...cur, playlists } : cur));
    } catch (err) {
      setActionError(errMsg(err));
    }
  }
  const { rowProps, posInputProps, move } = useReorderableRows(data?.playlists.map((p) => p.id) ?? [], reorder);

  if (!data) return <Status error={error} loading onRetry={reload} />;
  if (!data.context) return <p className="error" role="alert">Contexto não encontrado. Volte à lista e escolha outro.</p>;
  const { context, playlists } = data;
  const published = playlists.filter((p) => p.status === "published").length;

  function saveEdit(playlistId: string) {
    void run(async () => {
      await api.request("PUT", `/admin/playlists/${playlistId}`, draft);
      setEditing(null);
    });
  }
  /** Enter salva e Esc cancela, em qualquer campo da linha em edição. */
  const editKeys = (playlistId: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit(playlistId);
    if (e.key === "Escape") setEditing(null);
  };

  function startEdit(p: AdminPlaylistDto) {
    setEditing(p.id);
    setDraft({ title: p.title, slug: p.slug, description: p.description });
  }

  function create(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api.request("POST", `/admin/contexts/${id}/playlists`, created);
      setCreated({ title: "", description: "" });
    });
  }

  return (
    <>
      <Link className="back" to="/contexts">← Contextos</Link>
      <h2>{context.name}</h2>
      <p className="muted">
        {context.category}{context.description ? ` · ${context.description}` : ""} · {playlists.length} playlists, {published} publicadas
      </p>
      {context.details && (
        <div className="card note">
          <strong>Detalhamento</strong>
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{context.details}</p>
        </div>
      )}
      {actionError && <p className="error" role="alert">{actionError}</p>}

      {playlists.length === 0 ? (
        <p className="muted">Este contexto ainda não tem playlists. Crie a primeira abaixo.</p>
      ) : (
        <TableWrap>
          <thead>
            <tr><th><span className="sr-only">Arrastar</span></th><th>Pos.</th><th>Playlist</th><th>Status</th><th>Frases</th><th>Áudios</th><th>Mover para</th><th><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {playlists.map((p, i) => {
              const isEditing = editing === p.id;
              return (
                <tr key={p.id} {...rowProps(i)} draggable={!isEditing}>
                  <td className="handle" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" /><circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" /><circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" /></svg>
                  </td>
                  <td className="num">{p.position}</td>
                  <td>
                    {isEditing ? (
                      <div className="stack">
                        <input className="text" value={draft.title} placeholder="Título" aria-label="Título da playlist" autoFocus onKeyDown={editKeys(p.id)} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                        <input className="text" value={draft.slug} placeholder="slug" aria-label="Slug da playlist (único no contexto)" onKeyDown={editKeys(p.id)} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                        <input className="text" value={draft.description} placeholder="Descrição (aparece para o aluno)" aria-label="Descrição da playlist" onKeyDown={editKeys(p.id)} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                    ) : (
                      <>
                        <Link to={`/playlists/${p.id}`}>{p.title}</Link> <span className="muted">· {p.slug}</span>
                        {p.description && <div className="muted">{p.description}</div>}
                      </>
                    )}
                  </td>
                  <td><Badge kind={p.status}>{STATUS_LABEL[p.status]}</Badge></td>
                  <td className="num">{p.sentenceCount}</td>
                  <td className="num">{p.sentenceCount ? `${p.audioReady} de ${p.sentenceCount}` : "—"}</td>
                  <td>
                    <div className="row nowrap">
                      <span className="move">
                        <button type="button" aria-label={`Subir a playlist ${p.title}`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                        <button type="button" aria-label={`Descer a playlist ${p.title}`} disabled={i === playlists.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                      </span>
                      <input {...posInputProps(i)} aria-label={`Mover a playlist ${p.title} para a posição (Enter confirma)`} />
                    </div>
                  </td>
                  <td className="row">
                    {isEditing ? (
                      <>
                        <button type="button" className="primary" onClick={() => saveEdit(p.id)}>Salvar</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(p)}>Editar</button>
                        {p.sentenceCount === 0 && (
                          <button type="button" className="danger" onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir a playlist “${p.title}”?`,
                              body: "Ela está vazia e some do contexto; as outras playlists sobem uma posição.",
                              confirmLabel: "Excluir", danger: true,
                            });
                            if (ok) void run(() => api.request("DELETE", `/admin/playlists/${p.id}`));
                          }}>Excluir</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      {playlists.length > 0 && (
        <p className="muted">
          Arraste as linhas, use os botões de subir e descer, ou digite a posição de destino e tecle Enter. Só playlists sem frases podem ser excluídas; as outras podem ser arquivadas na tela da playlist.
        </p>
      )}

      <form className="form" onSubmit={create}>
        <label style={{ flex: 1 }}>
          Nova playlist (vai para o fim)
          <input required value={created.title} placeholder="Título" onChange={(e) => setCreated({ ...created, title: e.target.value })} />
        </label>
        <label style={{ flex: 2 }}>
          Descrição (opcional, aparece para o aluno)
          <input value={created.description} onChange={(e) => setCreated({ ...created, description: e.target.value })} />
        </label>
        <button className="primary" type="submit">Criar</button>
      </form>
      {confirmDialog}
    </>
  );
}
