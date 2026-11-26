-- Run once on databases made before accounts. Adds accounts, saved copies, and links scores to accounts.
ALTER TABLE scores ADD COLUMN account TEXT;
ALTER TABLE scores ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS scores_day_account ON scores (day, account) WHERE account IS NOT NULL;
CREATE INDEX IF NOT EXISTS scores_account ON scores (account);
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
CREATE TABLE IF NOT EXISTS saves (
  account TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  at INTEGER NOT NULL,
  data TEXT NOT NULL
);
