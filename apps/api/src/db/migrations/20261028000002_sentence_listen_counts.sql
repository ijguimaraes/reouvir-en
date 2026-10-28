-- migrate:up

-- Quantas vezes o aluno ouviu cada frase (cada audição que termina de tocar; pular não conta).
-- O cliente envia o total absoluto e o servidor guarda o maior (GREATEST): reenviar não duplica.
CREATE TABLE user_sentence_stats (
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sentence_id  uuid NOT NULL REFERENCES sentences (id) ON DELETE CASCADE,
  listen_count integer NOT NULL DEFAULT 0 CHECK (listen_count >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sentence_id)
);

-- migrate:down
DROP TABLE user_sentence_stats;
