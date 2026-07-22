-- AlterTable
ALTER TABLE "matches" ALTER COLUMN "court_number" DROP NOT NULL,
ALTER COLUMN "court_number" DROP DEFAULT;
