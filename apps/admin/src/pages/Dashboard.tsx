import { useCallback } from "react";
import { api } from "../api";
import { Status, useLoad } from "../ui";

interface Overview {
  playlists: { draft: number; empty: number; published: number; archived: number };
  students: number;
  audios: { ready: number; failed: number; orphans: number };
  ttsChars: number;
}

export function DashboardPage() {
  const load = useCallback(() => api.request<Overview>("GET", "/admin/overview"), []);
  const { data, error } = useLoad(load);

  if (!data) return <Status error={error} loading />;
  return (
    <>
      <h2>Painel</h2>
      <div className="cards">
        <div className="card"><b>{data.playlists.published}</b>playlists publicadas</div>
        <div className="card"><b>{data.playlists.draft}</b>rascunhos com frases</div>
        <div className="card"><b>{data.playlists.empty}</b>playlists sem frases</div>
        <div className="card"><b>{data.playlists.archived}</b>arquivadas</div>
        <div className="card"><b>{data.students}</b>alunos</div>
        <div className="card"><b>{data.audios.ready}</b>áudios gerados</div>
        <div className="card"><b>{data.ttsChars.toLocaleString("pt-BR")}</b>caracteres no TTS</div>
        <div className="card"><b>{data.audios.failed}</b>áudios com falha</div>
        <div className="card"><b>{data.audios.orphans}</b>áudios órfãos</div>
      </div>
      <p className="muted">Os caracteres incluem os áudios órfãos, pois já foram cobrados pelo TTS. Áudio órfão (sem frase no momento) é reaproveitado se a mesma frase voltar, com a mesma voz e o mesmo modelo.</p>
    </>
  );
}
