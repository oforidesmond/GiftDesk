import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcrypt';

interface User {
  id: number;
  username: string;
  password: string;
  phone: string | null;
  role: string;
  createdById: number | null;
}

interface Assignee {
  id: number;
  username: string;
  phone: string | null;
  role: string;
}

interface UpdateData {
  title?: string;
  location?: string | null;
  date?: string | null;
  type?: string;
  mcs?: { username: string; password: string; phone: string }[];
  deskAttendees?: { username: string; password: string; phone: string }[];
  removedMcs?: number[];
  removedDeskAttendees?: number[];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

 const { id } = await params;
  const eventId = parseInt(id);
  
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        assignees: {
          select: {
            id: true,
            username: true,
            phone: true,
            role: true,
          },
        },
      },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...event,
      mcs: event.assignees
        .filter((user: Assignee) => user.role === 'MC')
        .map((user: Assignee) => ({
          id: user.id,
          username: user.username,
          phone: user.phone || '',
        })),
      deskAttendees: event.assignees
        .filter((user: Assignee) => user.role === 'DESK_ATTENDEE')
        .map((user: Assignee) => ({
          id: user.id,
          username: user.username,
          phone: user.phone || '',
        })),
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventId = parseInt(params.id);
  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await prisma.event.delete({ where: { id: eventId } });
    // Note: Assignees (Users) are not deleted; only the relation is removed
    return NextResponse.json({ message: 'Event deleted' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting event:', {
    message: error.message,
    code: error.code,
    meta: error.meta,
  });
    return NextResponse.json({ error: 'Failed to delete event', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Await params to resolve the dynamic route parameter
  const { id } = await params;
  const eventId = parseInt(id);
  const data: UpdateData = await request.json();

  // Validate session.user.id
  const createdById = parseInt(session.user.id);
  if (isNaN(createdById)) {
    console.error('Invalid session.user.id:', session.user.id);
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  // Verify createdById exists
  const creator = await prisma.user.findUnique({
    where: { id: createdById },
  });
  if (!creator) {
    console.error('Creator user not found for ID:', createdById);
    return NextResponse.json({ error: 'Creator user not found' }, { status: 400 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { assignees: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Prepare update data for the event
    const updateEventData: any = {};
    if (data.title) updateEventData.title = data.title;
    if (data.location !== undefined) updateEventData.location = data.location;
    if (data.date !== undefined) updateEventData.date = data.date ? new Date(data.date) : null;
    if (data.type) updateEventData.type = data.type;

    const updateAssignees = async (
  role: 'MC' | 'DESK_ATTENDEE',
  newAssignees: { username: string; password: string; phone: string }[] | undefined,
  removedAssigneeIds: number[] | undefined
) => {
  if (!newAssignees || newAssignees.length === 0) {
    console.log(`No ${role} assignees provided, checking for removals`);
  } else {
    console.log(`Processing ${role} assignees:`, newAssignees);
  }

  // Fetch existing assignees for this role
  const existingAssignees = event.assignees.filter((user: User) => user.role === role);

  // Create or update assignees
  const assigneePromises = newAssignees
    ?.filter((assignee) => assignee && assignee.username && assignee.password && assignee.phone)
    .map(async (assignee) => {
      if (!assignee) {
        console.log('Skipping null assignee');
        return null;
      }

      const existingUser = existingAssignees.find((u: User) => u.username === assignee.username);
      if (existingUser) {
        const updates: any = {};
        if (assignee.phone !== existingUser.phone) updates.phone = assignee.phone;
        if (assignee.password) {
          const hashedPassword = await bcrypt.hash(assignee.password, 10);
          updates.password = hashedPassword;
          await prisma.userCredential.updateMany({
            where: { userId: existingUser.id },
            data: { password: assignee.password }, // Note: Address plain-text storage
          });
        }
        if (Object.keys(updates).length > 0) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: updates,
          });
        }
        return existingUser;
      } else {
        const hashedPassword = await bcrypt.hash(assignee.password, 10);
        console.log(`Creating new user for ${assignee.username} with createdById: ${createdById}`);
        try {
          const newUser = await prisma.user.create({
            data: {
              username: assignee.username,
              password: hashedPassword,
              phone: assignee.phone,
              role,
              createdById,
              assignedEvents: { connect: { id: eventId } },
            },
          });
          await prisma.userCredential.create({
            data: { userId: newUser.id, password: assignee.password }, // Note: Address plain-text storage
          });
          return newUser;
        } catch (error) {
          console.error(`Failed to create user ${assignee.username}:`, error);
          throw error;
        }
      }
    }) || [];

  const updatedUsers = (await Promise.all(assigneePromises)).filter(
    (user: User | null): user is User => user !== null
  );

  console.log(`Updated ${role} users:`, updatedUsers.map((u: User) => u.username));

  // Disconnect only explicitly removed assignees
  if (removedAssigneeIds && removedAssigneeIds.length > 0) {
    console.log(`Disconnecting ${role} users with IDs:`, removedAssigneeIds);
    await prisma.event.update({
      where: { id: eventId },
      data: { assignees: { disconnect: removedAssigneeIds.map((id) => ({ id })) } },
    });
  }

  return updatedUsers;
};

// Update MCs and Desk Attendees if provided
if (data.mcs || data.removedMcs) {
  await updateAssignees('MC', data.mcs || [], data.removedMcs);
}
if (data.deskAttendees || data.removedDeskAttendees) {
  await updateAssignees('DESK_ATTENDEE', data.deskAttendees || [], data.removedDeskAttendees);
}

    return NextResponse.json({ message: 'Event updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}