import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const {
    title,
    location,
    date,
    type,
    smsTemplate,
    mcs,
    deskAttendees,
  } = await request.json();

  // Validate required fields
  if (!title || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Create Event
    const event = await prisma.event.create({
      data: {
        title,
        location: location || null,
        date: date ? new Date(date) : null,
        type,
        createdById: Number(session.user.id),
      },
    });

    // Assign creator to the event
    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: {
        assignedEvents: {
          connect: { id: event.id },
        },
      },
    });

    // Create SMS Template if provided
    if (smsTemplate) {
      const existingTemplate = await prisma.sMSTemplate.findFirst({
        where: { eventId: event.id },
      });
      if (!existingTemplate) {
        await prisma.sMSTemplate.create({
          data: {
            eventId: event.id,
            content: smsTemplate,
            createdById: Number(session.user.id),
          },
        });
      }
    }

    // Create MCs if provided and non-empty
    let createdMcs: { id: number; username: string; password: string; phone: string; role: string }[] = [];
    if (Array.isArray(mcs) && mcs.length > 0) {
      createdMcs = await Promise.all(
        mcs.map(async (mc: { username: string; password: string; phone: string }) => {
          if (!mc.username || !mc.password) {
            throw new Error('MC username and password are required');
          }
          const hashedPassword = await bcrypt.hash(mc.password, 10);
          const user = await prisma.user.create({
            data: {
              username: mc.username,
              password: hashedPassword,
              phone: mc.phone || null,
              role: 'MC',
              createdById: Number(session.user.id),
              sentCredentials: false,
              assignedEvents: { connect: { id: event.id } },
            },
          });
          await prisma.userCredential.create({
            data: {
              userId: user.id,
              password: mc.password, // Store plain-text
            },
          });
          return { id: user.id, username: mc.username, password: mc.password, phone: mc.phone, role: 'MC' };
        })
      );
    }

    // Create Desk Attendees if provided and non-empty
    let createdAttendees: { id: number; username: string; password: string; phone: string; role: string }[] = [];
    if (Array.isArray(deskAttendees) && deskAttendees.length > 0) {
      createdAttendees = await Promise.all(
        deskAttendees.map(async (attendee: { username: string; password: string; phone: string }) => {
          if (!attendee.username || !attendee.password) {
            throw new Error('Desk Attendee username and password are required');
          }
          const hashedPassword = await bcrypt.hash(attendee.password, 10);
          const user = await prisma.user.create({
            data: {
              username: attendee.username,
              password: hashedPassword,
              phone: attendee.phone || null,
              role: 'DESK_ATTENDEE',
              createdById: Number(session.user.id),
              sentCredentials: false,
              assignedEvents: { connect: { id: event.id } },
            },
          });
          await prisma.userCredential.create({
            data: {
              userId: user.id,
              password: attendee.password, // Store plain-text
            },
          });
          return { id: user.id, username: attendee.username, password: attendee.password, phone: attendee.phone, role: 'DESK_ATTENDEE' };
        })
      );
    }

    return NextResponse.json({ event, mcs: createdMcs, deskAttendees: createdAttendees });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}