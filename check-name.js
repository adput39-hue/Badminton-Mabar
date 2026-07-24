require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
prisma.pb.findUnique({ where: { id: "default" } }).then(p => {
  console.log('PB default:', JSON.stringify(p));
  prisma.$disconnect();
});
