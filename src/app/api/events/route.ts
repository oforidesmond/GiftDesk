import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    where: { createdById: Number(session.user.id) },
    select: {
      id: true,
      title: true,
      location: true,
      date: true,
      type: true,
    },
  });

  return NextResponse.json(events);
}