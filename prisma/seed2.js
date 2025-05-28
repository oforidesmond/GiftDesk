 import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

async function main() {
  const hashedPassword = await bcrypt.hash('des123', 10);
  await prisma.user.upsert({
    where: { username: 'admin2' },
    update: {},
    create: {
      username: 'admin2',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });