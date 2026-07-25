DO $$ BEGIN
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
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_levels_name_key" ON "user_levels"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "user_levels_slug_key" ON "user_levels"("slug");

DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "level_id" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'users_level_id_fkey') THEN
      ALTER TABLE "users" ADD CONSTRAINT "users_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "user_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "gender" TEXT;
  ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "saldo_awal_hutang" INTEGER DEFAULT 0;
  ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'internal';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "htm" INTEGER;
  ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "sparing_opponent" TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "kas_biaya_pb_id_idx" ON "kas_biaya"("pb_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'kas_biaya_pb_id_fkey') THEN
    ALTER TABLE "kas_biaya" ADD CONSTRAINT "kas_biaya_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "kas_mutasi_pb_id_idx" ON "kas_mutasi"("pb_id");
CREATE INDEX IF NOT EXISTS "kas_mutasi_tanggal_idx" ON "kas_mutasi"("tanggal");
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'kas_mutasi_pb_id_fkey') THEN
    ALTER TABLE "kas_mutasi" ADD CONSTRAINT "kas_mutasi_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'kas_mutasi_biaya_id_fkey') THEN
    ALTER TABLE "kas_mutasi" ADD CONSTRAINT "kas_mutasi_biaya_id_fkey" FOREIGN KEY ("biaya_id") REFERENCES "kas_biaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "site_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "site_config_pkey" PRIMARY KEY ("key")
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
