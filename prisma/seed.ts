import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

await prisma.pb.upsert({
  where: { slug: "pb-default" },
  update: {},
  create: { id: "default", name: "PB Badminton Saya", slug: "pb-default" },
});
console.log("Default PB created");
await prisma.$disconnect();
