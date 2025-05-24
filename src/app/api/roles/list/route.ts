import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Define the type for the Prisma query result
type Assignee = {
  id: number;
  username: string;
  password: string | null;
  phone: string | null;
  role: 'MC' | 'DESK_ATTENDEE';
  sentCredentials: boolean | null;
  assignedEvents: {
    id: number;
    title: string;
  }[];
  userCredential: {
    password: string | null;
  } | null; 
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

 const assignees: Assignee[] = await prisma.user.findMany({
    where: {
      createdById: Number(session.user.id),
      role: { in: ['MC', 'DESK_ATTENDEE'] },
    },
    select: {
      id: true,
      username: true,
      password: true,
      phone: true,
      role: true,
      sentCredentials: true,
      assignedEvents: {
        select: {
          id: true,
          title: true,
        },
        take: 1,
      },
      userCredential: {
        select: {
          password: true,
        },
      },
    },
  });

  return NextResponse.json(
    assignees.map((a: Assignee) => ({
      id: a.id,
      username: a.username,
       password: a.userCredential?.password || '',
      phone: a.phone,
      role: a.role,
      sentCredentials: a.sentCredentials,
      event: a.assignedEvents[0] || { id: 0, title: 'Unknown' },
    }))
  );
}