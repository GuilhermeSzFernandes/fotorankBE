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
  phone         VARCHAR(20),
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
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Remove duplicatas mantendo a nota mais recente por (professor, foto)
DELETE FROM grades
WHERE id NOT IN (
  SELECT DISTINCT ON (teacher_id, photo_id) id
  FROM grades
  ORDER BY teacher_id, photo_id, updated_at DESC
);

-- Garante unicidade (idempotente: ignora se a constraint já existe)
DO $$ BEGIN
  ALTER TABLE grades ADD CONSTRAINT grades_teacher_photo_unique UNIQUE (teacher_id, photo_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token         TEXT          PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL,
  expires_at    TIMESTAMPTZ   NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  photo_id    UUID        REFERENCES photos(id) ON DELETE SET NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_photo_id_idx ON audit_logs(photo_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_event_idx    ON audit_logs(event);

-- Configuração única do concurso (sempre id=1)
CREATE TABLE IF NOT EXISTS contest_config (
  id                  INT           PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_start  TIMESTAMPTZ,
  registration_end    TIMESTAMPTZ,
  evaluation_start    TIMESTAMPTZ,
  evaluation_end      TIMESTAMPTZ,
  phase_override      VARCHAR(20)   CHECK (phase_override IN ('waiting','registration','evaluation','closed')),
  ranking_public      BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Migrações idempotentes para bases existentes
DO $$ BEGIN
  ALTER TABLE contest_config ADD COLUMN ranking_public BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN phone VARCHAR(20);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

INSERT INTO contest_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
