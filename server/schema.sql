-- One row per player per day. No names, no addresses: the client id is a random string made in the browser.
-- p1 to p7 are the points on each question, for per-question standings. account links a Roundup to an account;
-- verified is 1 when the server worked the score out itself from the loops. Older databases: migrate-1.sql, then migrate-2.sql.
CREATE TABLE IF NOT EXISTS scores (
  day INTEGER NOT NULL,
  client TEXT NOT NULL,
  score INTEGER NOT NULL,
  hits TEXT NOT NULL,
  at INTEGER NOT NULL,
  p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER, p6 INTEGER, p7 INTEGER,
  account TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, client)
);
CREATE UNIQUE INDEX IF NOT EXISTS scores_day_account ON scores (day, account) WHERE account IS NOT NULL;
CREATE INDEX IF NOT EXISTS scores_account ON scores (account);
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

-- Accounts: a public name, whether to list it, and a one-way fingerprint of the sign-in key. Nothing else about the person.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL UNIQUE,
  listed INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_created ON accounts (created);
-- A copy of the player's save, so their record follows them to another device. rev guards against two devices overwriting each other.
CREATE TABLE IF NOT EXISTS saves (
  account TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  at INTEGER NOT NULL,
  data TEXT NOT NULL
);
