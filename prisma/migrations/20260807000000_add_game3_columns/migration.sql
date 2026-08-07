-- Add missing game 3 score columns (not included in add_game2_support)
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "score_team1_game3" INTEGER;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "score_team2_game3" INTEGER;