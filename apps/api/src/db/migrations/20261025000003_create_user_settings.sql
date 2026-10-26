-- migrate:up
CREATE TABLE user_settings (
  user_id       uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  repeats       smallint NOT NULL DEFAULT 2 CHECK (repeats BETWEEN 1 AND 5),
  speed         numeric(3, 2) NOT NULL DEFAULT 1.00 CHECK (speed IN (0.75, 1.00)),
  loop_playlist boolean NOT NULL DEFAULT true
);

-- migrate:down
DROP TABLE user_settings;
