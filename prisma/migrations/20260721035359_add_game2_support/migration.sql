-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "score_team1_game2" INTEGER,
ADD COLUMN     "score_team2_game2" INTEGER,
ADD COLUMN     "total_games" INTEGER NOT NULL DEFAULT 1;
