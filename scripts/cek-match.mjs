import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const env = readFileSync(".env", "utf-8");
const url = env.split("\n").find(l => l.startsWith("DATABASE_URL="))?.split("=").slice(1).join("=")?.trim();
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });
try {
  const scheds = await prisma.schedule.findMany({ where: { tournamentId: { not: null } }, select: { id: true, title: true, tournamentId: true } });
  console.log("Tournament Schedules:", scheds.length, JSON.stringify(scheds, null, 2));
  const matches = await prisma.match.findMany({ where: { schedule: { tournamentId: { not: null } } }, select: { id: true, scheduleId: true, status: true, team1Player1Id: true } });
  console.log("Tournament Matches:", matches.length, JSON.stringify(matches.map(m => ({ id: m.id, status: m.status })), null, 2));
  const allMatches = await prisma.match.count();
  console.log("Total all matches:", allMatches);
} catch (e) { console.error(e); } finally { await prisma.$disconnect(); }
