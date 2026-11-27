-- Side by side rooms moved to Rodeo rooms (rodeo.js, one Durable Object per room), so the old room tables go.
-- Run once on the real database: wrangler d1 execute cinch-standings --remote --file migrate-3.sql
DROP TABLE IF EXISTS picks;
DROP TABLE IF EXISTS rooms;
