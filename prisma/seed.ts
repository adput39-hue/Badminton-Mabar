import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaultPb = await prisma.pb.upsert({
    where: { slug: "pb-default" },
    update: {},
    create: { id: "default", name: "PB Badminton Saya", slug: "pb-default" },
  });
  console.log("PB default:", defaultPb.id);

  const superPassword = await bcrypt.hash("AdminPbSuper", 10);
  await prisma.user.upsert({
    where: { email: "AdminPb@Super.com" },
    update: { role: "superadmin", pbId: null, password: superPassword },
    create: { email: "AdminPb@Super.com", fullName: "Super Admin", password: superPassword, role: "superadmin", pbId: null },
  });
  console.log("Super admin: AdminPb@Super.com / AdminPbSuper");

  const adminPassword = await bcrypt.hash("AdminTest123", 10);
  await prisma.user.upsert({
    where: { email: "AdminTest@yopmail.com" },
    update: { role: "admin_pb", pbId: "default", password: adminPassword },
    create: { email: "AdminTest@yopmail.com", fullName: "Admin Testing", password: adminPassword, role: "admin_pb", pbId: "default" },
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
