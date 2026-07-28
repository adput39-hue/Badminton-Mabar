const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const tournaments = await prisma.$queryRawUnsafe("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tournaments' ORDER BY ordinal_position");
  console.log("=== TOURNAMENTS ===");
  console.table(tournaments);
  const teams = await prisma.$queryRawUnsafe("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'teams' ORDER BY ordinal_position");
  console.log("=== TEAMS ===");
  console.table(teams);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
