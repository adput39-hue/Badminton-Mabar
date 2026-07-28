-- Add tournament fields
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS total_match_goal INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_match_per_team INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game_format VARCHAR(10) DEFAULT '1x30';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS courts TEXT;

-- Add team icon
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icon VARCHAR(255);
