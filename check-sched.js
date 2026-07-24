require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
prisma.schedule.findMany({ select: { id: true, title: true, sparingOpponent: true, pbId: true, date: true } }).then(r => {
  r.forEach(s => console.log(s.id, '|', s.title, '| opponent=' + s.sparingOpponent, '| pbId=' + s.pbId, '|', s.date));
  prisma.$disconnect();
});
