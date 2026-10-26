import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDetailDto, PlaylistStatsDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, TableWrap, useConfirm, useLoad } from "../ui";

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

  if (!data) return <Status error={error} loading onRetry={reload} />;
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
      <Link className="back" to={`/contexts/${detail.contextId}`}>← {detail.contextName}</Link>
      <h2>{detail.contextName} / {detail.levelCode} / {detail.topicName}</h2>
      <div className="row">
        <Badge kind={detail.status}>{STATUS_LABEL[detail.status]}</Badge>
        <span className="muted">versão {detail.version}</span>
        {detail.status === "draft" && <button type="button" className="primary" onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/publish`))}>Publicar</button>}
        {detail.status !== "draft" && <button type="button" onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/unpublish`))}>Despublicar</button>}
        {detail.status !== "archived" && <button type="button" onClick={() => run(() => api.request("POST", `/admin/playlists/${id}/archive`))}>Arquivar</button>}
      </div>
      <div className="cards" style={{ margin: "var(--space-4) 0" }}>
        <div className="card"><b>{stats.sentences}</b>frases</div>
        <div className="card"><b>{stats.audioReady} / {stats.sentences}</b>áudios gerados</div>
        <div className="card"><b>{stats.ttsChars}</b>caracteres no TTS</div>
        <div className="card"><b>{stats.studentsStarted}</b>alunos iniciaram</div>
      </div>
      {actionError && <p className="error" role="alert">{actionError}</p>}

      <TableWrap>
        <thead><tr><th><span className="sr-only">Arrastar</span></th><th>Pos.</th><th>Frase</th><th>Áudio</th><th>Mover</th><th><span className="sr-only">Ações</span></th></tr></thead>
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
                <td className="handle" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" /><circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" /><circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" /></svg>
                </td>
                <td className="num">{s.position}</td>
                <td className="text-cell">
                  <input
                    className="text" value={value} aria-label={`Texto da frase ${s.position}`} lang="en"
                    onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })}
                  />
                  <span className="muted chars num">{value.length} caracteres{value !== s.text ? " · não salva" : ""}</span>
                </td>
                <td>{s.audioReady ? <Badge kind="done">gerado</Badge> : <Badge kind="draft">pendente</Badge>}</td>
                <td>
                  <div className="row nowrap">
                    <span className="move">
                      <button type="button" aria-label={`Subir a frase ${s.position}`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                      <button type="button" aria-label={`Descer a frase ${s.position}`} disabled={i === sentences.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                    </span>
                    <input
                      className="pos" type="number" min={1} max={sentences.length} placeholder={String(i + 1)}
                      aria-label={`Mover a frase ${s.position} para a posição (Enter confirma)`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") move(i, Number((e.target as HTMLInputElement).value) - 1);
                      }}
                    />
                  </div>
                </td>
                <td>
                  <div className="row">
                    {value !== s.text && (
                      <button type="button" className="primary" onClick={() => run(async () => {
                        await api.request("PATCH", `/admin/sentences/${s.id}`, { text: value });
                        setEdits(({ [s.id]: _, ...rest }) => rest);
                      })}>Salvar</button>
                    )}
                    <button type="button" className="danger" onClick={async () => {
                      const ok = await confirm({
                        title: `Remover a frase ${s.position}?`,
                        body: `"${s.text}" sai da playlist e deixa uma lacuna na numeração. O áudio já gerado é mantido.`,
                        confirmLabel: "Remover", danger: true,
                      });
                      if (ok) void run(() => api.request("DELETE", `/admin/sentences/${s.id}`));
                    }}>Remover</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      <p className="muted">Arraste as linhas, use os botões de subir e descer, ou digite a posição de destino e tecle Enter. Editar uma frase gera outro áudio para o novo texto.</p>

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
          <input required value={newText} lang="en" onChange={(e) => setNewText(e.target.value)} />
        </label>
        <button className="primary" type="submit">Adicionar</button>
      </form>
      {confirmDialog}
    </>
  );
}
