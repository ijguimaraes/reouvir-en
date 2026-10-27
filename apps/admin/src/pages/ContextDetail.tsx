import { useCallback, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDto, ContextDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, useLoad, useReorderableRows } from "../ui";

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
  const { rowProps, posInputProps } = useReorderableRows(data?.playlists.map((p) => p.id) ?? [], reorder);

  if (!data) return <Status error={error} loading />;
  if (!data.context) return <p className="error">Contexto não encontrado.</p>;
  const { context, playlists } = data;
  const published = playlists.filter((p) => p.status === "published").length;

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
      <p><Link to="/contexts">← Contextos</Link></p>
      <h2>{context.name}</h2>
      <p className="muted">
        {context.category}{context.description ? ` · ${context.description}` : ""} · {playlists.length} playlists, {published} publicadas
      </p>
      {context.details && (
        <div className="card" style={{ margin: "12px 0" }}>
          <strong>Detalhamento</strong>
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{context.details}</p>
        </div>
      )}
      {actionError && <p className="error">{actionError}</p>}

      {playlists.length === 0 ? (
        <p className="muted">Este contexto ainda não tem playlists. Crie a primeira abaixo.</p>
      ) : (
        <table>
          <thead>
            <tr><th /><th>Pos.</th><th>Playlist</th><th>Status</th><th>Frases</th><th>Áudios</th><th>Mover para</th><th /></tr>
          </thead>
          <tbody>
            {playlists.map((p, i) => {
              const isEditing = editing === p.id;
              return (
                <tr key={p.id} {...rowProps(i)} draggable={!isEditing}>
                  <td className="handle">⠿</td>
                  <td>{p.position}</td>
                  <td>
                    {isEditing ? (
                      <div className="stack">
                        <input className="text" value={draft.title} placeholder="Título" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                        <input className="text" value={draft.slug} placeholder="slug" onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                        <input className="text" value={draft.description} placeholder="Descrição (aparece para o aluno)" onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                    ) : (
                      <>
                        <Link to={`/playlists/${p.id}`}>{p.title}</Link> <span className="muted">· {p.slug}</span>
                        {p.description && <div className="muted">{p.description}</div>}
                      </>
                    )}
                  </td>
                  <td><Badge kind={p.status}>{STATUS_LABEL[p.status]}</Badge></td>
                  <td>{p.sentenceCount}</td>
                  <td>{p.sentenceCount ? `${p.audioReady} de ${p.sentenceCount}` : "—"}</td>
                  <td><input {...posInputProps(i)} /></td>
                  <td className="row">
                    {isEditing ? (
                      <>
                        <button className="primary" onClick={() => run(async () => {
                          await api.request("PUT", `/admin/playlists/${p.id}`, draft);
                          setEditing(null);
                        })}>Salvar</button>
                        <button onClick={() => setEditing(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)}>Editar</button>
                        {p.sentenceCount === 0 && (
                          <button className="danger" onClick={() => window.confirm(`Excluir a playlist “${p.title}”?`) && run(() => api.request("DELETE", `/admin/playlists/${p.id}`))}>Excluir</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {playlists.length > 0 && (
        <p className="muted">
          Arraste as linhas, ou digite a posição de destino e tecle Enter. Só playlists sem frases podem ser excluídas; as outras podem ser arquivadas na tela da playlist.
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
    </>
  );
}
