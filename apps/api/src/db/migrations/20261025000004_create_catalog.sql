-- migrate:up
CREATE TABLE levels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE grammar_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id   uuid NOT NULL REFERENCES levels (id) ON DELETE RESTRICT,
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);
CREATE INDEX grammar_topics_level_idx ON grammar_topics (level_id);

CREATE TABLE contexts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  category    text NOT NULL,
  active      boolean NOT NULL DEFAULT true
);

-- migrate:down
DROP TABLE contexts;
DROP TABLE grammar_topics;
DROP TABLE levels;
