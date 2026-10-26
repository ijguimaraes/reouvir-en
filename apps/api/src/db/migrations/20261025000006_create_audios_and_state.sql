-- migrate:up
CREATE TABLE audios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_key     text NOT NULL UNIQUE,
  text_hash     text NOT NULL,
  voice_id      text NOT NULL,
  model_id      text NOT NULL,
  settings_hash text NOT NULL,
  storage_key   text,
  duration_ms   integer,
  char_count    integer NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error         text,
  attempts      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audios_text_hash_idx ON audios (text_hash);

CREATE TABLE user_playlist_state (
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  playlist_id       uuid NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  -- sem a frase (removida/substituída), a retomada volta ao início
  last_sentence_id  uuid REFERENCES sentences (id) ON DELETE SET NULL,
  loops_completed   integer NOT NULL DEFAULT 0,
  listened_seconds  integer NOT NULL DEFAULT 0,
  client_updated_at timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, playlist_id)
);

-- migrate:down
DROP TABLE user_playlist_state;
DROP TABLE audios;
