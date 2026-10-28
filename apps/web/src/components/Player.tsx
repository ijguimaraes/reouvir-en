import { useEffect, useRef, useState } from "react";
import type { PlayerSettings } from "@reouvir/shared";
import { persistSettings } from "../offline/settings";
import { saveState } from "../offline/sync";
import { bindMediaSession, HtmlAudioDriver } from "../player/driver";
import { PlayerEngine, type EngineState } from "../player/engine";
import type { PlaybackSource } from "../player/source";
import { IconNext, IconPause, IconPlay, IconPrev } from "./Icons";

export interface PlayerInit {
  playlistId: string;
  source: PlaybackSource;
  startIndex: number;
  baseLoops: number;
  baseListenedSeconds: number;
  title: string;
  context: string;
  settings: PlayerSettings;
}

const fmt = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + " h " : ""}${Math.floor((s % 3600) / 60)} min`;

export function Player({ init }: { init: PlayerInit }) {
  const { source } = init;
  const [state, setState] = useState<EngineState>({
    index: init.startIndex, repetition: 0, phase: "stopped", paused: true, silenceMs: 0, silenceRemainingMs: 0, loops: 0,
  });
  const [settings, setSettings] = useState(init.settings);
  const [error, setError] = useState("");
  const engineRef = useRef<PlayerEngine | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const driver = new HtmlAudioDriver();
    let latestIndex = init.startIndex;

    const save = () => {
      const e = engineRef.current;
      if (!e) return;
      void saveState({
        playlistId: init.playlistId,
        lastSentenceId: source.items[latestIndex]?.id ?? null,
        loopsCompleted: init.baseLoops + e.state.loops,
        listenedSeconds: init.baseListenedSeconds + Math.round(e.getListenedMs() / 1000),
      });
    };

    const engine = new PlayerEngine({
      length: source.items.length,
      startIndex: init.startIndex,
      settings: init.settings,
      driver,
      resolve: (i) => {
        source.prefetch(i);
        return source.resolve(i);
      },
      onChange: setState,
      onItem: (i) => {
        latestIndex = i;
        save();
      },
      onLoop: save,
      onError: () => setError("Não foi possível tocar. Verifique a conexão ou baixe a playlist."),
    });
    engineRef.current = engine;
    source.prefetch(init.startIndex - 1);

    const unbind = bindMediaSession(
      { title: init.title, artist: "Reouvir EN", album: init.context },
      { play: () => engine.play(), pause: () => engine.pause(), next: () => engine.next(), prev: () => engine.prev() },
    );
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);

    return () => {
      save();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      unbind();
      engine.destroy();
      engineRef.current = null;
    };
    // O motor é criado uma vez por playlist/versão (a página usa `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state.paused ? "paused" : "playing";
  }, [state.paused]);

  // mantém a frase atual visível na lista (rola só a lista, nunca a página)
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[state.index] as HTMLElement | undefined;
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
  }, [state.index]);

  // anima a barra do silêncio
  const [, force] = useState(0);
  useEffect(() => {
    if (state.phase !== "silence" || state.paused) return;
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [state.phase, state.paused]);

  const engine = engineRef.current;
  const live = engine?.state ?? state;
  const current = source.items[state.index];

  function change(patch: Partial<PlayerSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    engineRef.current?.updateSettings(next);
    void persistSettings(next);
  }

  const label =
    state.paused ? "Pausado"
    : state.phase === "loading" ? "Preparando o áudio…"
    : state.phase === "playing" ? `Ouvindo · repetição ${state.repetition + 1} de ${settings.repeats}`
    : state.phase === "silence" ? `Sua vez · repetição ${state.repetition + 1} de ${settings.repeats}`
    : "Pronto";
  const silencePct = state.silenceMs ? (1 - live.silenceRemainingMs / state.silenceMs) * 100 : 0;
  const listened = init.baseListenedSeconds + Math.round((engine?.getListenedMs() ?? 0) / 1000);

  return (
    <section>
      <div className="now" lang="en">{current?.text}</div>

      <div className="dock">
        <div className={`status ${state.paused ? "" : state.phase}`} role="status">{label}</div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${state.phase === "silence" ? silencePct : 0}%` }} /></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="controls">
          <button onClick={() => engine?.prev()} aria-label="Frase anterior"><IconPrev /></button>
          <button className="play" onClick={() => { setError(""); engine?.toggle(); }} aria-label={state.paused ? "Tocar" : "Pausar"}>
            {state.paused ? <IconPlay /> : <IconPause />}
          </button>
          <button onClick={() => engine?.next()} aria-label="Próxima frase"><IconNext /></button>
        </div>
        <p className="muted count num">Frase {state.index + 1} de {source.items.length}</p>
      </div>

      <h3 className="section-title">Configurações</h3>
      <label className="toggle">
        Repetições seguidas
        <select value={settings.repeats} onChange={(e) => change({ repeats: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="toggle" role="group" aria-labelledby="speed-label">
        <span id="speed-label">Velocidade</span>
        <span className="segmented">
          {([0.75, 1] as const).map((v) => (
            <button key={v} type="button" aria-pressed={settings.speed === v} onClick={() => change({ speed: v })}>{v}x</button>
          ))}
        </span>
      </div>
      <label className="toggle">
        Repetir a playlist (loop)
        <input type="checkbox" role="switch" checked={settings.loop} onChange={(e) => change({ loop: e.target.checked })} />
      </label>
      <p className="muted">O silêncio entre audições é automático: duração do áudio ÷ velocidade + 1,5 s.</p>

      <h3 className="section-title">Progresso</h3>
      <div className="kv"><span>Voltas completas</span><b className="num">{init.baseLoops + state.loops}</b></div>
      <div className="kv"><span>Tempo ouvido</span><b className="num">{fmt(listened)}</b></div>

      <h3 className="section-title">Frases</h3>
      <ol className="sentences" ref={listRef} lang="en">
        {source.items.map((s, i) => (
          <li key={s.id}>
            <button type="button" aria-current={i === state.index ? "true" : undefined} onClick={() => engine?.seek(i)}>
              <span>{i + 1}</span>{s.text}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
