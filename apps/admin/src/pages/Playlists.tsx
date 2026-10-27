import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDetailDto, PlaylistStatsDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, useLoad, useReorderableRows } from "../ui";

export function PlaylistDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(
    async () => {
      const [detail, stats] = await Promise.all([
        api.request<AdminPlaylistDetailDto>("GET", `/admin/playlists/${id}`),
        api.request<PlaylistStatsDto>("GET", `/admin/playlists/${id}/stats`),
      ]);
      return { detail, stats };
    },
    [id],
  );
  const { data, error, reload, setData } = useLoad(load);
  const [actionError, setActionError] = useState("");
  const [newText, setNewText] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

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
      const updated = await api.request<AdminPlaylistDetailDto>("PUT", `/admin/playlists/${id}/order`, { ids });
      setData((cur) => (cur ? { ...cur, detail: updated } : cur));
    } catch (err) {
      setActionError(errMsg(err));
    }
  }
  const { rowProps, posInputProps } = useReorderableRows(data?.detail.sentences.map((s) => s.id) ?? [], reorder);

  if (!data) return <Status error={error} loading />;
  const { detail, stats } = data;
  const sentences = detail.sentences;

  return (
    <>
      <p><Link to={`/contexts/${detail.contextId}`}>← {detail.contextName}</Link></p>
      <h2>{detail.contextName} / {detail.title}</h2>
      {detail.description && <p className="muted">{detail.description}</p>}
      <div className="row">
        <Badge kind={detail.status}>{STATUS_LABEL[detail.status]}</Badge>
        <span className="muted">versão {detail.version}</span>
        {detail.status === "draft" && <button className="primary" onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/publish`))}>Publicar</button>}
        {detail.status !== "draft" && <button onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/unpublish`))}>Despublicar</button>}
        {detail.status !== "archived" && <button onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/archive`))}>Arquivar</button>}
      </div>
      <div className="cards" style={{ margin: "16px 0" }}>
        <div className="card"><b>{stats.sentences}</b>frases</div>
        <div className="card"><b>{stats.audioReady} / {stats.sentences}</b>áudios gerados</div>
        <div className="card"><b>{stats.ttsChars}</b>caracteres no TTS</div>
        <div className="card"><b>{stats.studentsStarted}</b>alunos iniciaram</div>
      </div>
      {actionError && <p className="error">{actionError}</p>}

      <table>
        <thead><tr><th /><th>Pos.</th><th>Frase</th><th>Áudio</th><th>Mover para</th><th /></tr></thead>
        <tbody>
          {sentences.map((s, i) => {
            const value = edits[s.id] ?? s.text;
            return (
              <tr key={s.id} {...rowProps(i)}>
                <td className="handle">⠿</td>
                <td>{s.position}</td>
                <td>
                  <input className="text" value={value} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                </td>
                <td>{s.audioReady ? <span className="ok">●</span> : <span className="muted">○</span>}</td>
                <td>
                  <input {...posInputProps(i)} />
                </td>
                <td className="row">
                  {value !== s.text && (
                    <button onClick={() => run(async () => {
                      await api.request("PATCH", `/admin/sentences/${s.id}`, { text: value });
                      setEdits(({ [s.id]: _, ...rest }) => rest);
                    })}>Salvar</button>
                  )}
                  <button className="danger" onClick={() => window.confirm("Remover a frase?") && run(() => api.request("DELETE", `/admin/sentences/${s.id}`))}>Remover</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">Arraste as linhas, ou digite a posição de destino e tecle Enter. Editar uma frase gera outro áudio para o novo texto.</p>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.request("POST", `/admin/playlists/${id}/sentences`, { text: newText });
            setNewText("");
          });
        }}
      >
        <label style={{ flex: 1 }}>
          Nova frase (vai para o fim)
          <input required value={newText} onChange={(e) => setNewText(e.target.value)} />
        </label>
        <button className="primary" type="submit">Adicionar</button>
      </form>
    </>
  );
}
