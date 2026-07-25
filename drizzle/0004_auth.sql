CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at integer NOT NULL
);

CREATE TABLE sessions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at integer NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
