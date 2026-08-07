-- Add HTM member type for incidental players + member incidental type flag
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "member_type" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "htm_insidentil" INTEGER;