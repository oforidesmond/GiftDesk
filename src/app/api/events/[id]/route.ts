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
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
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
      newAssignees: { username: string; password: string; phone: string }[] | undefined
    ) => {
      if (!newAssignees || newAssignees.length === 0) {
        console.log(`No ${role} assignees provided, skipping update`);
        return;
      }

      // Log input for debugging
      console.log(`Processing ${role} assignees:`, newAssignees);

      // Fetch existing assignees for this role
      const existingAssignees = event.assignees.filter((user: User) => user.role === role);

      // Create or update assignees
      const assigneePromises = newAssignees
        .filter((assignee) => assignee && assignee.username && assignee.password && assignee.phone)
        .map(async (assignee) => {
          if (!assignee) {
            console.log('Skipping null assignee');
            return null;
          }

          // Check if user exists by username
          const existingUser = existingAssignees.find((u: User) => u.username === assignee.username);
          if (existingUser) {
            // Update existing user if needed
            const updates: any = {};
            if (assignee.phone !== existingUser.phone) updates.phone = assignee.phone;
            if (assignee.password) {
              const hashedPassword = await bcrypt.hash(assignee.password, 10);
              updates.password = hashedPassword;
              console.log(`Updating user ${existingUser.username} with:`, updates);
              // Update UserCredential if needed (security concern noted)
              await prisma.userCredential.updateMany({
                where: { userId: existingUser.id },
                data: { password: assignee.password }, // Plain-text (address this)
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
            // Create new user
            const hashedPassword = await bcrypt.hash(assignee.password, 10);
            console.log(`Creating new user for ${assignee.username} with createdById: ${createdById}`);
            try {
              const newUser = await prisma.user.create({
                data: {
                  username: assignee.username,
                  password: hashedPassword,
                  phone: assignee.phone,
                  role,
                  createdById, // Nullable in schema
                  assignedEvents: { connect: { id: eventId } },
                },
              });
              await prisma.userCredential.create({
                data: { userId: newUser.id, password: assignee.password }, // Plain-text (address this)
              });
              return newUser;
            } catch (error) {
              console.error(`Failed to create user ${assignee.username}:`, error);
              throw error;
            }
          }
        });

      // Filter out null results before processing
      const updatedUsers = (await Promise.all(assigneePromises)).filter(
        (user: User | null): user is User => user !== null
      );

      // Log updated users
      console.log(`Updated ${role} users:`, updatedUsers.map((u: User) => u.username));

      // Disconnect users not in the new list
      const newUsernames = newAssignees
        .filter((a) => a && a.username)
        .map((a) => a.username);
      const usersToDisconnect = existingAssignees
        .filter((u: User) => !newUsernames.includes(u.username))
        .map((u: User) => ({ id: u.id }));

      if (usersToDisconnect.length > 0) {
        console.log(`Disconnecting users:`, usersToDisconnect);
        await prisma.event.update({
          where: { id: eventId },
          data: { assignees: { disconnect: usersToDisconnect } },
        });
      }

      return updatedUsers;
    };

    // Update event only if there are changes
    if (Object.keys(updateEventData).length > 0) {
      await prisma.event.update({
        where: { id: eventId },
        data: updateEventData,
      });
    }

    // Update MCs and Desk Attendees if provided
    if (data.mcs) await updateAssignees('MC', data.mcs);
    if (data.deskAttendees) await updateAssignees('DESK_ATTENDEE', data.deskAttendees);

    return NextResponse.json({ message: 'Event updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}