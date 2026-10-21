CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL DEFAULT '',
  sort INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL DEFAULT '',
  desc_ru TEXT NOT NULL DEFAULT '',
  desc_kk TEXT NOT NULL DEFAULT '',
  price INT NOT NULL CHECK (price >= 0),
  weight TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL DEFAULT '',
  required BOOLEAN NOT NULL DEFAULT false,
  multi BOOLEAN NOT NULL DEFAULT false,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modifiers (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL DEFAULT '',
  price_delta INT NOT NULL DEFAULT 0,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  number INT UNIQUE NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  opened_by INT REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_cash INT NOT NULL DEFAULT 0,
  closing_cash INT,
  expected_cash INT,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cash_entries (
  id SERIAL PRIMARY KEY,
  shift_id INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('in','out')),
  amount INT NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,
  number INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dine_in','delivery','pickup')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','ready','done','cancelled')),
  table_id INT REFERENCES tables(id),
  customer_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address JSONB,
  comment TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card_terminal','kaspi','online')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','paid','failed')),
  subtotal INT NOT NULL,
  delivery_fee INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  scheduled_for TIMESTAMPTZ,
  shift_id INT REFERENCES shifts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INT REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  unit_price INT NOT NULL,
  modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount INT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title_ru TEXT NOT NULL,
  title_kk TEXT NOT NULL DEFAULT '',
  text_ru TEXT NOT NULL DEFAULT '',
  text_kk TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
