import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminPlaylistDto, ContextDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, Status, STATUS_LABEL, useLoad } from "../ui";

/** Tópicos do contexto, por nível: cada um é uma playlist, onde se importam as frases. */
export function ContextDetailPage() {
  const { id = "" } = useParams();
  const load = useCallback(async () => {
    const [contexts, playlists] = await Promise.all([
      api.request<ContextDto[]>("GET", "/admin/contexts"),
      api.request<AdminPlaylistDto[]>("GET", `/admin/playlists?contextId=${id}`),
    ]);
    return { context: contexts.find((c) => c.id === id) ?? null, playlists };
  }, [id]);
  const { data, error } = useLoad(load);

  if (!data) return <Status error={error} loading />;
  if (!data.context) return <p className="error">Contexto não encontrado.</p>;

  const levels = [...new Set(data.playlists.map((p) => p.levelCode))];
  const filled = data.playlists.filter((p) => p.sentenceCount > 0).length;

  return (
    <>
      <p><Link to="/contexts">← Contextos</Link></p>
      <h2>{data.context.name}</h2>
      <p className="muted">
        {data.context.category}{data.context.description ? ` · ${data.context.description}` : ""} · {filled} de {data.playlists.length} tópicos com frases
      </p>
      {data.context.details && (
        <div className="card" style={{ margin: "12px 0" }}>
          <strong>Detalhamento</strong>
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{data.context.details}</p>
        </div>
      )}

      {levels.map((level) => (
        <section key={level}>
          <h3>{level}</h3>
          <table>
            <thead><tr><th>Tópico</th><th>Status</th><th>Frases</th><th>Áudios</th></tr></thead>
            <tbody>
              {data.playlists.filter((p) => p.levelCode === level).map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/playlists/${p.id}`}>{p.topicName}</Link></td>
                  <td>
                    {p.sentenceCount === 0 ? <span className="muted">vazia</span> : <Badge kind={p.status}>{STATUS_LABEL[p.status]}</Badge>}
                  </td>
                  <td>{p.sentenceCount}</td>
                  <td>{p.sentenceCount ? `${p.audioReady} de ${p.sentenceCount}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
