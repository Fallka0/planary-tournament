-- Plans v2: the tiers are gratis and plus. verein becomes plus; event (a pass for one
-- tournament) becomes gratis with the pass on that tournament.
ALTER TABLE tournaments ADD COLUMN has_pass INTEGER NOT NULL DEFAULT 0;
-- A Gratis draft that goes out by itself when the owner's running tournament ends.
ALTER TABLE tournaments ADD COLUMN publish_when_free INTEGER NOT NULL DEFAULT 0;
UPDATE tournaments SET has_pass = 1, plan = 'gratis' WHERE plan = 'event';
UPDATE tournaments SET plan = 'plus' WHERE plan = 'verein';
