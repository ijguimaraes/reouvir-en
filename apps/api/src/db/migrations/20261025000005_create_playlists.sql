-- migrate:up
CREATE TABLE playlists (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_topic_id uuid NOT NULL REFERENCES grammar_topics (id) ON DELETE RESTRICT,
  context_id       uuid NOT NULL REFERENCES contexts (id) ON DELETE RESTRICT,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  -- sobe a cada mudança de conteúdo; o app offline compara para oferecer "Atualizar download"
  version          integer NOT NULL DEFAULT 1,
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz,
  UNIQUE (grammar_topic_id, context_id)
);

CREATE TABLE sentences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  text        text NOT NULL,
  text_hash   text NOT NULL,
  char_count  integer NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- DEFERRABLE permite renumerar tudo numa transação (reordenação)
  CONSTRAINT sentences_playlist_position_key UNIQUE (playlist_id, position) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (playlist_id, text_hash)
);
CREATE INDEX sentences_text_hash_idx ON sentences (text_hash);

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
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX imports_content_hash_idx ON imports (content_hash);

-- migrate:down
DROP TABLE imports;
DROP TABLE sentences;
DROP TABLE playlists;
