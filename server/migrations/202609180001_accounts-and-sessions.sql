-- Up Migration
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sites ADD COLUMN owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
-- Existing data from checkpoint 3 consists only of explicitly marked demo sites.
ALTER TABLE sites ADD CONSTRAINT sites_ownership CHECK (
  (is_demo AND owner_id IS NULL) OR (NOT is_demo AND owner_id IS NOT NULL)
);
CREATE INDEX sites_owner_id_idx ON sites (owner_id);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Down Migration
DROP TABLE sessions;
ALTER TABLE sites DROP CONSTRAINT sites_ownership;
ALTER TABLE sites DROP COLUMN owner_id;
DROP TABLE users;
