-- CreateTable: user_levels
CREATE TABLE IF NOT EXISTS "user_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "menus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_levels_name_key" ON "user_levels"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "user_levels_slug_key" ON "user_levels"("slug");

-- AlterTable: users
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "level_id" TEXT;
ALTER TABLE IF EXISTS "users" ADD CONSTRAINT IF NOT EXISTS "users_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "user_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: members
ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "saldo_awal_hutang" INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'internal';

-- AlterTable: schedules
ALTER TABLE IF EXISTS "schedules" ADD COLUMN IF NOT EXISTS "htm" INTEGER;
ALTER TABLE IF EXISTS "schedules" ADD COLUMN IF NOT EXISTS "sparing_opponent" TEXT;

-- CreateTable: kas_biaya
CREATE TABLE IF NOT EXISTS "kas_biaya" (
    "id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kas_biaya_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "kas_biaya_pb_id_idx" ON "kas_biaya"("pb_id");
ALTER TABLE IF EXISTS "kas_biaya" ADD CONSTRAINT IF NOT EXISTS "kas_biaya_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: kas_mutasi
CREATE TABLE IF NOT EXISTS "kas_mutasi" (
    "id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "biaya_id" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "member_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kas_mutasi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "kas_mutasi_pb_id_idx" ON "kas_mutasi"("pb_id");
CREATE INDEX IF NOT EXISTS "kas_mutasi_tanggal_idx" ON "kas_mutasi"("tanggal");
ALTER TABLE IF EXISTS "kas_mutasi" ADD CONSTRAINT IF NOT EXISTS "kas_mutasi_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE IF EXISTS "kas_mutasi" ADD CONSTRAINT IF NOT EXISTS "kas_mutasi_biaya_id_fkey" FOREIGN KEY ("biaya_id") REFERENCES "kas_biaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: site_config
CREATE TABLE IF NOT EXISTS "site_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "site_config_pkey" PRIMARY KEY ("key")
);
