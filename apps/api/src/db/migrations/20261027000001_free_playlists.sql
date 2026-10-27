-- migrate:up

-- Playlists livres: o nível e o tópico gramatical saem do modelo. A playlist passa a pertencer só a um
-- contexto e ter título, slug, descrição e posição próprios.

-- Já não existe tópico que gere playlist.
DROP TRIGGER IF EXISTS grammar_topics_playlists_aiu ON grammar_topics;
DROP FUNCTION IF EXISTS grammar_topics_create_playlists();

-- As playlists vazias que o sistema criava sozinho (uma por tópico) e que ninguém usou não viram playlists livres.
DELETE FROM playlists p
 WHERE p.status = 'draft'
   AND NOT EXISTS (SELECT 1 FROM sentences s WHERE s.playlist_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM user_playlist_state u WHERE u.playlist_id = p.id);

-- O catálogo do aluno escondia playlists de tópico ou nível inativo. Sem esses filtros elas apareceriam de repente.
UPDATE playlists p
   SET status = 'archived'
  FROM grammar_topics t
  JOIN levels l ON l.id = t.level_id
 WHERE t.id = p.grammar_topic_id
   AND p.status = 'published'
   AND (NOT t.active OR NOT l.active);

ALTER TABLE playlists
  ADD COLUMN title       text,
  ADD COLUMN slug        text,
  ADD COLUMN position    integer,
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN updated_at  timestamptz NOT NULL DEFAULT now();

-- Título e slug do tópico; posição na ordem do currículo (nível, depois tópico), por contexto, de 1 a n.
UPDATE playlists p
   SET title = r.name, slug = r.slug, position = r.pos
  FROM (
    SELECT p2.id, t.name, t.slug,
           row_number() OVER (PARTITION BY p2.context_id ORDER BY l.sort_order, l.name, t.sort_order, t.name) AS pos
      FROM playlists p2
      JOIN grammar_topics t ON t.id = p2.grammar_topic_id
      JOIN levels l ON l.id = t.level_id
  ) r
 WHERE r.id = p.id;

ALTER TABLE playlists
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN position SET NOT NULL,
  ADD CONSTRAINT playlists_title_check CHECK (title <> ''),
  ADD CONSTRAINT playlists_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
  ADD CONSTRAINT playlists_context_slug_key UNIQUE (context_id, slug),
  ADD CONSTRAINT playlists_context_position_key UNIQUE (context_id, position) DEFERRABLE INITIALLY DEFERRED;

-- Leva junto o FK e o UNIQUE (grammar_topic_id, context_id).
ALTER TABLE playlists DROP COLUMN grammar_topic_id;

DROP TABLE grammar_topics;
DROP TABLE levels;

-- migrate:down

-- A mudança descarta níveis e tópicos, então não há volta fiel por migração. O caminho de volta é restaurar o pg_dump
-- feito antes de aplicá-la.
DO $$
BEGIN
  RAISE EXCEPTION 'Migração irreversível (níveis e tópicos foram removidos): restaure o backup do banco.';
END $$;
