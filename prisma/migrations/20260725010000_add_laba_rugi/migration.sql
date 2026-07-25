-- CreateTable
CREATE TABLE "laba_rugi" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "pb_id" TEXT NOT NULL,
    "total_income" INTEGER NOT NULL,
    "cock_cost" INTEGER NOT NULL DEFAULT 0,
    "court_cost" INTEGER NOT NULL DEFAULT 0,
    "cock_biaya_id" TEXT,
    "court_biaya_id" TEXT,
    "profit_loss" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "laba_rugi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "laba_rugi_schedule_id_key" ON "laba_rugi"("schedule_id");

-- CreateIndex
CREATE INDEX "laba_rugi_pb_id_idx" ON "laba_rugi"("pb_id");

-- AddForeignKey
ALTER TABLE "laba_rugi" ADD CONSTRAINT "laba_rugi_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laba_rugi" ADD CONSTRAINT "laba_rugi_pb_id_fkey" FOREIGN KEY ("pb_id") REFERENCES "pb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laba_rugi" ADD CONSTRAINT "laba_rugi_cock_biaya_id_fkey" FOREIGN KEY ("cock_biaya_id") REFERENCES "kas_biaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laba_rugi" ADD CONSTRAINT "laba_rugi_court_biaya_id_fkey" FOREIGN KEY ("court_biaya_id") REFERENCES "kas_biaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;
