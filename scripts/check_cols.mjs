import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const tournaments = await prisma.$queryRawUnsafe("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tournaments' ORDER BY ordinal_position");
  console.log("=== TOURNAMENTS ===");
  console.table(tournaments);
  const teams = await prisma.$queryRawUnsafe("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'teams' ORDER BY ordinal_position");
  console.log("=== TEAMS ===");
  console.table(teams);
} catch(e) { console.error(e); }
finally { await prisma.$disconnect(); }
