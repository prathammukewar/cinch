-- One row per player per day. No names, no addresses: the client id is a random string made in the browser.
CREATE TABLE IF NOT EXISTS scores (
  day INTEGER NOT NULL,
  client TEXT NOT NULL,
  score INTEGER NOT NULL,
  hits TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (day, client)
);
CREATE INDEX IF NOT EXISTS scores_day_score ON scores (day, score);

-- Side by side rooms: two riders on two devices play the same questions at the same time.
-- A room lives for six hours. Tokens are random secrets, one per seat, so only that rider can answer for it.
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  q TEXT NOT NULL,
  n0 TEXT NOT NULL,
  t0 TEXT NOT NULL,
  n1 TEXT,
  t1 TEXT
);
CREATE TABLE IF NOT EXISTS picks (
  code TEXT NOT NULL,
  seat INTEGER NOT NULL,
  i INTEGER NOT NULL,
  lo REAL NOT NULL,
  hi REAL NOT NULL,
  fence INTEGER NOT NULL,
  scout INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (code, seat, i)
);
