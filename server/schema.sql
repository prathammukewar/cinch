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
