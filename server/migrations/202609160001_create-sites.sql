-- Up Migration
CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  location text NOT NULL CHECK (char_length(btrim(location)) BETWEEN 1 AND 200),
  capacity_kw numeric(10, 3) NOT NULL CHECK (capacity_kw > 0 AND capacity_kw <= 1000000),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE sites;
