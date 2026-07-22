-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_created_by_fkey";

-- AlterTable
ALTER TABLE "schedules" ALTER COLUMN "created_by" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
