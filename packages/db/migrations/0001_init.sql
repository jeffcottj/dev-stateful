CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_meta (key, value) VALUES ('template_status', 'ok');
