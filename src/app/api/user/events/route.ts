import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type Event = {
  id: number;
  title: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['MC', 'DESK_ATTENDEE'].includes(session.user.role)) {
    console.error('Unauthorized access to /api/user/events', {
      userId: session?.user?.id,
      role: session?.user?.role,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const userId = Number(session.user.id);
    const events: Event[] = await prisma.event.findMany({
      where: {
        assignees: { some: { id: userId } },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (events.length === 0) {
      console.warn('No events found for user', { userId, role: session.user.role });
    } else {
      console.log('Events fetched for user', {
        userId,
        eventIds: events.map((e: Event) => e.id),
        eventTitles: events.map((e) => e.title),
      });
    }

    return NextResponse.json(events);
  } catch (error) {
    const err = error as Error; // Cast error to Error
    console.error('Error fetching user events', {
      error: err.message,
      userId: session?.user?.id,
    });
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}