-- Add standings settings to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS standings_mode VARCHAR(20) DEFAULT 'points';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS win_points INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS draw_points INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS loss_points INTEGER;