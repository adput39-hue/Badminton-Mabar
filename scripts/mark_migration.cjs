const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const migrationName = "20260728000000_add_tournament_fields";
  const checksum = require("fs").readFileSync(`prisma/migrations/${migrationName}/migration.sql`);
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(checksum).digest("hex");
  await prisma.$queryRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)
     ON CONFLICT (migration_name) DO UPDATE SET finished_at = NOW(), rolled_back_at = NULL`,
    crypto.randomUUID(), hash, migrationName
  );
  console.log("Migration marked as applied:", migrationName);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
