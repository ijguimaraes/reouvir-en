-- migrate:up
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  name                 text NOT NULL,
  password_hash        text NOT NULL,
  role                 text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_login_at        timestamptz
);

CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- migrate:down
DROP TABLE users;
