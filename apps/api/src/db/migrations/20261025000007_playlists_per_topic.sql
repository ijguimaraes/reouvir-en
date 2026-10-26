-- migrate:up
-- Níveis e tópicos são fixos: cada contexto tem uma playlist (vazia, em rascunho) por tópico.
-- Gera as que faltam nos contextos já existentes.
INSERT INTO playlists (grammar_topic_id, context_id)
SELECT t.id, c.id FROM grammar_topics t CROSS JOIN contexts c WHERE t.active
ON CONFLICT (grammar_topic_id, context_id) DO NOTHING;

-- Histórico de importações passa a ser por playlist (tópico).
ALTER TABLE imports ADD COLUMN playlist_id uuid REFERENCES playlists (id) ON DELETE CASCADE;
CREATE INDEX imports_playlist_idx ON imports (playlist_id, created_at DESC);

-- migrate:down
DROP INDEX imports_playlist_idx;
ALTER TABLE imports DROP COLUMN playlist_id;
