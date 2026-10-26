import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDetailDto, PlaylistStatsDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, useLoad } from "../ui";

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
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
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

  if (!data) return <Status error={error} loading />;
  const { detail, stats } = data;
  const sentences = detail.sentences;

  async function reorder(ids: string[]) {
    setActionError("");
    try {
      const updated = await api.request<AdminPlaylistDetailDto>("PUT", `/admin/playlists/${id}/order`, { ids });
      setData({ ...data!, detail: updated });
    } catch (err) {
      setActionError(errMsg(err));
    }
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= sentences.length) return;
    const ids = sentences.map((s) => s.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    void reorder(ids);
  }

  return (
    <>
      <p><Link to={`/contexts/${detail.contextId}`}>← {detail.contextName}</Link></p>
      <h2>{detail.contextName} / {detail.levelCode} / {detail.topicName}</h2>
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
              <tr
                key={s.id}
                className={dragOver === i && dragFrom !== null ? "dragover" : undefined}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                onDrop={() => { if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDragOver(null); }}
              >
                <td className="handle">⠿</td>
                <td>{s.position}</td>
                <td>
                  <input className="text" value={value} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                </td>
                <td>{s.audioReady ? <span className="ok">●</span> : <span className="muted">○</span>}</td>
                <td>
                  <input
                    className="pos" type="number" min={1} max={sentences.length} placeholder={String(i + 1)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") move(i, Number((e.target as HTMLInputElement).value) - 1);
                    }}
                  />
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
