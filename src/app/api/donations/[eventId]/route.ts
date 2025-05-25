import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> } // Type params as Promise
) {
  try {
    const params = await context.params; // Await params
    const session = await getServerSession(authOptions);
    if (!session || !['MC', 'DESK_ATTENDEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const eventId = Number(params.eventId);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }

    // Verify user is assigned to the event
    const isAssigned = await prisma.user.findFirst({
      where: {
        id: Number(session.user.id),
        assignedEvents: { some: { id: eventId } },
      },
    });

    if (!isAssigned) {
      return NextResponse.json({ error: 'Unauthorized for this event' }, { status: 403 });
    }

    const donations = await prisma.donation.findMany({
      where: { eventId },
      select: {
        id: true,
        donorName: true,
        donorPhone: true,
        giftItem: true,
        amount: true,
        notes: true,
        status: true,
        createdAt: true,
        event: { select: { title: true } },
      },
    });

    return NextResponse.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> } // Type params as Promise
) {
  try {
    const params = await context.params; // Await params
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'DESK_ATTENDEE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const eventId = Number(params.eventId);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }

    // Verify Desk Attendee is assigned to the event
    const isAssigned = await prisma.user.findFirst({
      where: {
        id: Number(session.user.id),
        assignedEvents: { some: { id: eventId } },
      },
    });

    if (!isAssigned) {
      return NextResponse.json({ error: 'Unauthorized for this event' }, { status: 403 });
    }

    const { donorName, donorPhone, giftItem, amount, notes, sendSMS } = await request.json();

    const donation = await prisma.donation.create({
      data: {
        donorName,
        donorPhone,
        giftItem,
        amount: Number(amount),
        notes,
        eventId,
        createdById: Number(session.user.id),
        status: 'PENDING',
      },
    });

    let smsTemplate = '';
    if (sendSMS) {
      const template = await prisma.sMSTemplate.findFirst({
        where: { eventId },
        select: { content: true },
      });
      smsTemplate = template?.content || '';
    }

    return NextResponse.json({ donation, smsTemplate });
  } catch (error) {
    console.error('Error creating donation:', error);
    return NextResponse.json({ error: 'Failed to create donation' }, { status: 500 });
  }
}