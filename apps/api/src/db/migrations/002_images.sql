-- Загруженные из админки фото блюд. Лежат в базе, потому что файловая система на хостинге не сохраняется между перезапусками.
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
