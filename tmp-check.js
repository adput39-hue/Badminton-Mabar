const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const m = await p.match.findUnique({ where: { id: 'a5a6fb13-000c-4ea9-a882-832d1065b23e' } });
  console.log('Match:', JSON.stringify(m, null, 2));
  await p.$disconnect();
})();
