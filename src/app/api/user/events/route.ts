import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['MC', 'DESK_ATTENDEE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    where: {
      assignees: { some: { id: Number(session.user.id) } },
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json(events);
}