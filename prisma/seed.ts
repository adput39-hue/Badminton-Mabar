import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const allMenuKeys = [
  "dashboard", "members", "schedules", "mabar", "riwayat",
  "sparing", "scoreboard", "users", "user-levels",
  "finances", "stats", "reports", "settings",
];

async function main() {
  const adminLevel = await prisma.userLevel.upsert({
    where: { slug: "admin" },
    update: { menus: allMenuKeys },
    create: { name: "Admin", slug: "admin", description: "Akses penuh ke semua menu", color: "#0d9488", menus: allMenuKeys },
  });
  console.log("Default Admin level:", adminLevel.id);

  const superPw = await bcrypt.hash("AdminPbSuper", 10);
  await prisma.user.upsert({
    where: { email: "AdminPb@Super.com" },
    update: { role: "superadmin", pbId: null, password: superPw },
    create: { email: "AdminPb@Super.com", fullName: "Super Admin", password: superPw, role: "superadmin", pbId: null },
  });
  console.log("Super admin: AdminPb@Super.com / AdminPbSuper");

  const testPw = await bcrypt.hash("AdminTest123", 10);
  await prisma.user.upsert({
    where: { email: "AdminTest@yopmail.com" },
    update: { role: "admin_pb", pbId: "default", password: testPw, levelId: adminLevel.id },
    create: { email: "AdminTest@yopmail.com", fullName: "Admin Testing", password: testPw, role: "admin_pb", pbId: "default", levelId: adminLevel.id },
  });
  console.log("Admin PB: AdminTest@yopmail.com / AdminTest123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
