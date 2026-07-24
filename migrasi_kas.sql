-- ============================================================
-- Migration: Add gender column, kas_biaya & kas_mutasi tables
-- Execute di Supabase SQL Editor (atau via psql)
-- ============================================================

-- 1. Tambah kolom gender ke tabel members
ALTER TABLE "public"."members" ADD COLUMN IF NOT EXISTS "gender" TEXT;

-- 2. Tabel master biaya (kategori pemasukan/pengeluaran)
CREATE TABLE IF NOT EXISTS "public"."kas_biaya" (
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

-- 3. Tabel mutasi kas (transaksi keuangan)
CREATE TABLE IF NOT EXISTS "public"."kas_mutasi" (
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

-- 4. Index untuk performa
CREATE INDEX IF NOT EXISTS "kas_biaya_pb_id_idx" ON "public"."kas_biaya"("pb_id");
CREATE INDEX IF NOT EXISTS "kas_mutasi_pb_id_idx" ON "public"."kas_mutasi"("pb_id");
CREATE INDEX IF NOT EXISTS "kas_mutasi_tanggal_idx" ON "public"."kas_mutasi"("tanggal");

-- 5. Foreign keys
ALTER TABLE "public"."kas_biaya"
  ADD CONSTRAINT "kas_biaya_pb_id_fkey"
  FOREIGN KEY ("pb_id") REFERENCES "public"."pb"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."kas_mutasi"
  ADD CONSTRAINT "kas_mutasi_pb_id_fkey"
  FOREIGN KEY ("pb_id") REFERENCES "public"."pb"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."kas_mutasi"
  ADD CONSTRAINT "kas_mutasi_biaya_id_fkey"
  FOREIGN KEY ("biaya_id") REFERENCES "public"."kas_biaya"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;