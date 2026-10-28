import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDetailDto, PlaylistStatsDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, TableWrap, useConfirm, useLoad, useReorderableRows } from "../ui";

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
      const updated = await api.request<AdminPlaylistDetailDto>("PUT", `/admin/playlists/${id}/order`, { ids });
      setData((cur) => (cur ? { ...cur, detail: updated } : cur));
    } catch (err) {
      setActionError(errMsg(err));
    }
  }
  const { rowProps, posInputProps, move } = useReorderableRows(data?.detail.sentences.map((s) => s.id) ?? [], reorder);

  if (!data) return <Status error={error} loading onRetry={reload} />;
  const { detail, stats } = data;
  const sentences = detail.sentences;

  return (
    <>
      <Link className="back" to={`/contexts/${detail.contextId}`}>← {detail.contextName}</Link>
      <h2>{detail.contextName} / {detail.title}</h2>
      {detail.description && <p className="muted">{detail.description}</p>}
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
              <tr key={s.id} {...rowProps(i)}>
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
                    <input {...posInputProps(i)} aria-label={`Mover a frase ${s.position} para a posição (Enter confirma)`} />
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
