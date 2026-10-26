-- migrate:up

-- 1) Não há mais importação de arquivo: a pipeline grava direto no banco.
DROP TABLE imports;

-- 2) Detalhamento do contexto (guia interno: cenário, situações, objetivos...).
ALTER TABLE contexts ADD COLUMN details text NOT NULL DEFAULT '';

-- 3) Integridade para quem escreve direto no banco (pipeline). ---------------------------------

-- Mesma normalização de packages/shared (normalizeText): NFC, aspas retas, "..." e espaços únicos.
CREATE FUNCTION normalize_sentence(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(
    regexp_replace(
      replace(
        translate(normalize(t, NFC), E'‘’ʼ“”', chr(39) || chr(39) || chr(39) || chr(34) || chr(34)),
        E'…', '...'),
      E'[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+', ' ', 'g'),
    ' ')
$$;

-- text, text_hash e char_count sempre coerentes, mesmo que o INSERT só traga o texto.
CREATE FUNCTION sentences_derive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.text := normalize_sentence(NEW.text);
  IF NEW.text = '' THEN
    RAISE EXCEPTION 'frase vazia' USING ERRCODE = '23514';
  END IF;
  NEW.text_hash := encode(sha256(convert_to(NEW.text, 'UTF8')), 'hex');
  NEW.char_count := char_length(NEW.text);
  RETURN NEW;
END $$;

CREATE TRIGGER sentences_derive_biu
  BEFORE INSERT OR UPDATE OF text ON sentences
  FOR EACH ROW EXECUTE FUNCTION sentences_derive();

-- A versão da playlist sobe a cada mudança de conteúdo (o app offline compara para "Atualizar download").
-- Um gatilho por comando (não por linha): importar 100 frases num INSERT sobe a versão uma vez.
CREATE FUNCTION sentences_bump_new() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE playlists SET version = version + 1 WHERE id IN (SELECT DISTINCT playlist_id FROM new_rows);
  RETURN NULL;
END $$;

CREATE FUNCTION sentences_bump_old() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE playlists SET version = version + 1 WHERE id IN (SELECT DISTINCT playlist_id FROM old_rows);
  RETURN NULL;
END $$;

CREATE TRIGGER sentences_bump_ins AFTER INSERT ON sentences
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION sentences_bump_new();
CREATE TRIGGER sentences_bump_upd AFTER UPDATE ON sentences
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION sentences_bump_new();
CREATE TRIGGER sentences_bump_del AFTER DELETE ON sentences
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION sentences_bump_old();

-- Tópico novo (ou reativado) ganha a playlist vazia em todos os contextos existentes.
CREATE FUNCTION grammar_topics_create_playlists() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO playlists (grammar_topic_id, context_id)
    SELECT NEW.id, c.id FROM contexts c
    ON CONFLICT (grammar_topic_id, context_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER grammar_topics_playlists_aiu
  AFTER INSERT OR UPDATE OF active ON grammar_topics
  FOR EACH ROW EXECUTE FUNCTION grammar_topics_create_playlists();

-- migrate:down
DROP TRIGGER grammar_topics_playlists_aiu ON grammar_topics;
DROP FUNCTION grammar_topics_create_playlists();
DROP TRIGGER sentences_bump_del ON sentences;
DROP TRIGGER sentences_bump_upd ON sentences;
DROP TRIGGER sentences_bump_ins ON sentences;
DROP FUNCTION sentences_bump_old();
DROP FUNCTION sentences_bump_new();
DROP TRIGGER sentences_derive_biu ON sentences;
DROP FUNCTION sentences_derive();
DROP FUNCTION normalize_sentence(text);
ALTER TABLE contexts DROP COLUMN details;
CREATE TABLE imports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id   uuid REFERENCES contexts (id) ON DELETE SET NULL,
  filename     text,
  content_hash text NOT NULL,
  status       text NOT NULL CHECK (status IN ('done', 'partial', 'failed')),
  options      jsonb NOT NULL,
  report       jsonb NOT NULL,
  source       jsonb,
  created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  playlist_id  uuid REFERENCES playlists (id) ON DELETE CASCADE
);
CREATE INDEX imports_content_hash_idx ON imports (content_hash);
CREATE INDEX imports_playlist_idx ON imports (playlist_id, created_at DESC);
