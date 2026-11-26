-- Run once on databases made before per-question points: each rider's points on each of the seven.
ALTER TABLE scores ADD COLUMN p1 INTEGER;
ALTER TABLE scores ADD COLUMN p2 INTEGER;
ALTER TABLE scores ADD COLUMN p3 INTEGER;
ALTER TABLE scores ADD COLUMN p4 INTEGER;
ALTER TABLE scores ADD COLUMN p5 INTEGER;
ALTER TABLE scores ADD COLUMN p6 INTEGER;
ALTER TABLE scores ADD COLUMN p7 INTEGER;
