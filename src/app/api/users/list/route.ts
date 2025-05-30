import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: 'EVENT_OWNER' },
    select: {
      id: true,
      username: true,
      phone: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}