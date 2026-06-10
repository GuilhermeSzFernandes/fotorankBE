-- ─────────────────────────────────────────────────────────────
-- FotoRank – Schema PostgreSQL
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'participant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  role          user_role     NOT NULL DEFAULT 'participant',
  avatar        TEXT,
  etec          VARCHAR(255),
  student_type  VARCHAR(50),
  cpf           VARCHAR(14)   UNIQUE,         -- obrigatório para participantes (enforced na app)
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photos (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT          NOT NULL,
  original_name TEXT          NOT NULL,
  url           TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id      UUID          NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  score         NUMERIC(4,2)  NOT NULL CHECK (score >= 1 AND score <= 10),
  comment       TEXT          NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, photo_id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token         TEXT          PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL,
  expires_at    TIMESTAMPTZ   NOT NULL
);
