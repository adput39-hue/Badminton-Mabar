const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const d = await p.match.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
  console.log('Pertandingan pertama:', d?.createdAt);
  const pb = await p.pb.findFirst({ select: { createdAt: true, name: true } });
  console.log('PB pertama:', pb?.name, pb?.createdAt);
  const user = await p.user.findFirst({ select: { createdAt: true, email: true } });
  console.log('User pertama:', user?.email, user?.createdAt);
  await p.$disconnect();
})();
