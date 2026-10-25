/* Armazenamento fictício compartilhado entre o app do aluno e o backoffice.
   Substitui API + Postgres. Tudo fica em localStorage (mesma origem). */
const SILENCE_PAD_MS = 1500;
const calcularSilencioMs = (durationMs, speed) => Math.round(durationMs / speed + SILENCE_PAD_MS);

const Store = (() => {
  const KEY = 'reouvir-proto-v3';
  const uid = () => Math.random().toString(36).slice(2, 10);

  // "audio_key" fictício: hash simples do texto normalizado
  const norm = (t) => t.trim().replace(/\s+/g, ' ');
  const audioKey = (t) => {
    let h = 5381;
    for (const c of norm(t)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
    return h.toString(16).padStart(8, '0');
  };
  const slugify = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const estDurationMs = (t) => Math.max(1200, norm(t).length * 62);

  const seed = () => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((c, i) => ({ id: c, code: c, name: c, order: i + 1, active: true }));
    const T = (levelId, names) => names.map((name, i) => ({ id: uid(), levelId, slug: slugify(name), name, order: i + 1, active: true }));
    const topics = [
      ...T('A1', ['Verbo to be', 'Pronomes pessoais e possessivos', 'Artigos a/an/the', 'Plural dos substantivos', 'this/that/these/those', 'there is/there are', 'Present Simple', 'can (habilidade)', 'Imperativo', 'Preposições in, on, at', 'Números, datas e horas']),
      ...T('A2', ['Past Simple', 'Present Continuous', 'Futuro com going to e will', 'Comparativos e superlativos', 'have to/must/should']),
      ...T('B1', ['Present Perfect', 'Present Perfect vs. Past Simple', 'Primeira e segunda condicional', 'Voz passiva']),
      ...T('B2', ['Terceira condicional', 'wish/if only', 'Past Perfect']),
      ...T('C1', ['Inversão formal', 'Hedging']),
      ...T('C2', ['Nuances semânticas', 'Idioms e figuras de linguagem']),
    ];
    const contexts = [
      ['Entrevista de engenheiro de software (Java)', 'Trabalho'], ['Daily stand-up de equipe de software', 'Trabalho'],
      ['Code review', 'Trabalho'], ['Reunião de equipe', 'Trabalho'], ['Apresentação de projeto', 'Trabalho'],
      ['Entrevista de emprego (geral)', 'Trabalho'], ['Aeroporto e viagem de avião', 'Viagem'], ['Hotel e hospedagem', 'Viagem'],
      ['Restaurante', 'Cotidiano'], ['Supermercado e compras', 'Cotidiano'], ['Consulta médica', 'Cotidiano'],
      ['Academia e exercícios', 'Cotidiano'], ['Rotina diária', 'Cotidiano'], ['Conhecendo pessoas (small talk)', 'Social'],
    ].map(([name, category]) => ({ id: uid(), slug: slugify(name), name, category, description: '', active: true }));

    const tp = (n) => topics.find((t) => t.name === n).id;
    const cx = (n) => contexts.find((c) => c.name.startsWith(n)).id;
    const pl = (topicId, contextId, status, texts) => {
      const id = uid();
      return { playlist: { id, topicId, contextId, status, createdAt: Date.now(), publishedAt: status === 'published' ? Date.now() : null, version: 1 },
        sentences: texts.map((text, i) => ({ id: uid(), playlistId: id, position: i + 1, text })) };
    };
    const p1 = pl(tp('Verbo to be'), cx('Entrevista de engenheiro'), 'published', [
      'I am a Java developer.', 'My name is Carlos.', 'I am from Brazil.', 'We are a small team.', 'The project is very interesting.',
      'Are you ready for the interview?', 'I am not nervous today.', 'My manager is very friendly.', 'The office is in the city center.',
      'You are on time.', 'Is this the right room?', 'They are in a meeting now.']);
    const p2 = pl(tp('Present Simple'), cx('Rotina'), 'published', [
      'I wake up at six every day.', 'She drinks coffee in the morning.', 'We take the bus to work.', 'He does not eat breakfast.',
      'Do you go to the gym after work?', 'They watch TV at night.', 'My brother plays the guitar.', 'I go to bed at eleven.']);
    const p3 = pl(tp('Past Simple'), cx('Restaurante'), 'draft', []);
    const audios = {};
    [...p1.sentences, ...p2.sentences].forEach((s) => { audios[audioKey(s.text)] = { durationMs: estDurationMs(s.text), chars: norm(s.text).length }; });

    return {
      levels, topics, contexts,
      playlists: [p1.playlist, p2.playlist, p3.playlist],
      sentences: [...p1.sentences, ...p2.sentences, ...p3.sentences],
      audios,
      users: [
        { id: 'u-admin', email: 'admin@reouvir.en', name: 'Administrador', password: 'admin123', role: 'admin', status: 'active', mustChange: false, createdAt: Date.now(), lastLoginAt: null },
        { id: 'u-aluno', email: 'aluno@teste.com', name: 'Aluno Teste', password: '123456', role: 'student', status: 'active', mustChange: false, createdAt: Date.now(), lastLoginAt: null },
        { id: 'u-bloq', email: 'bloqueado@teste.com', name: 'Aluno Bloqueado', password: '123456', role: 'student', status: 'blocked', mustChange: false, createdAt: Date.now(), lastLoginAt: null },
      ],
      sessions: { web: null, admin: null },
      settings: {},      // por usuário: { repeats, speed, loop }
      server: {},        // `${userId}:${playlistId}` -> { sentenceId, loops, seconds }
      local: {},         // estado local do aparelho (pode estar pendente)
      offline: {},       // `${userId}:${playlistId}` -> manifesto baixado
      online: true,      // simulação de rede (aparelho)
      imports: [],       // histórico de importações
    };
  };

  let db;
  const load = () => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {} return seed(); };
  db = load();
  const api = {
    get db() { return db; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} },
    reload() { db = load(); },
    reset() { db = seed(); api.save(); },
    uid, norm, audioKey, estDurationMs, slugify,
    sorted(pid) { return db.sentences.filter((s) => s.playlistId === pid).sort((a, b) => a.position - b.position); },
    topic: (id) => db.topics.find((t) => t.id === id),
    context: (id) => db.contexts.find((c) => c.id === id),
    level: (id) => db.levels.find((l) => l.id === id),
    playlist: (id) => db.playlists.find((p) => p.id === id),
    title(p) { const t = api.topic(p.topicId); const c = api.context(p.contextId); return { level: t.levelId, topic: t.name, context: c.name }; },
    audioDur(text) { const a = db.audios[api.audioKey(text)]; return a ? a.durationMs : api.estDurationMs(text); },
    hasAudio(text) { return !!db.audios[api.audioKey(text)]; },
    ensureAudio(text, durationMs) {
      const k = api.audioKey(text);
      if (!db.audios[k]) db.audios[k] = { durationMs: durationMs || api.estDurationMs(text), chars: api.norm(text).length };
      return db.audios[k];
    },
  };
  // mantém as duas abas sincronizadas
  window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); window.dispatchEvent(new Event('store-sync')); } });
  return api;
})();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtS = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const fmtMin = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? '<1 min' : m + ' min'; };
const fmtDate = (t) => t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/* Tema claro/escuro: segue o sistema, com alternância manual (vale para os dois apps). */
const Theme = {
  KEY: 'reouvir-theme',
  get() { try { return localStorage.getItem(this.KEY); } catch (e) { return null; } },
  effective() { return this.get() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); },
  apply() { const t = this.get(); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; },
  toggle() { try { localStorage.setItem(this.KEY, this.effective() === 'dark' ? 'light' : 'dark'); } catch (e) {} this.apply(); },
  label() { return this.effective() === 'dark' ? '☀ Claro' : '🌙 Escuro'; },
};
Theme.apply();
