-- migrate:up

-- Tradução da frase para o português. Fica fora da chave do áudio: editá-la nunca invalida áudio já gerado.
ALTER TABLE sentences ADD COLUMN translation_pt text;
ALTER TABLE sentences ADD CONSTRAINT sentences_translation_pt_not_blank
  CHECK (translation_pt IS NULL OR btrim(translation_pt) <> '');

-- Normaliza a tradução (NFC, aspas, espaços) também para quem escreve direto no banco; vazio vira NULL.
-- Mudar a tradução sobe a versão da playlist pelos gatilhos sentences_bump_* (o app offline baixa de novo).
CREATE FUNCTION sentences_normalize_translation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.translation_pt IS NOT NULL THEN
    NEW.translation_pt := NULLIF(normalize_sentence(NEW.translation_pt), '');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sentences_translation_biu
  BEFORE INSERT OR UPDATE OF translation_pt ON sentences
  FOR EACH ROW EXECUTE FUNCTION sentences_normalize_translation();

-- Preferências do aluno no player.
ALTER TABLE user_settings
  ADD COLUMN show_translation boolean NOT NULL DEFAULT true,
  ADD COLUMN keep_screen_on   boolean NOT NULL DEFAULT false;

-- migrate:down
ALTER TABLE user_settings DROP COLUMN keep_screen_on, DROP COLUMN show_translation;
DROP TRIGGER sentences_translation_biu ON sentences;
DROP FUNCTION sentences_normalize_translation();
ALTER TABLE sentences DROP CONSTRAINT sentences_translation_pt_not_blank;
ALTER TABLE sentences DROP COLUMN translation_pt;
