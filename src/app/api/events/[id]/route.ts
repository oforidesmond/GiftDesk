import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

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
   smsTemplate?: string;
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
      select: {
        id: true,
        title: true,
        location: true,
        date: true,
        type: true,
        assignees: {
          select: {
            id: true,
            username: true,
            phone: true,
            role: true,
          },
        },
        smsTemplates: {
          select: {
            id: true,
            content: true, 
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc', 
          },
          take: 1, 
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
        smsTemplate: event.smsTemplates[0]?.content || '',
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const eventId = parseInt(id);
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

  const { id } = await params;
  const eventId = parseInt(id);
  const data: UpdateData = await request.json();

  const createdById = parseInt(session.user.id);
  if (isNaN(createdById)) {
    console.error('Invalid session.user.id:', session.user.id);
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const creator = await prisma.user.findUnique({
    where: { id: createdById },
  });
  if (!creator) {
    console.error('Creator user not found for ID:', createdById);
    return NextResponse.json({ error: 'Creator user not found' }, { status: 400 });
  }

  try {
    // Prepare update data for the event
    const updateEventData: any = {};
    if (data.title) updateEventData.title = data.title;
    if (data.location !== undefined) updateEventData.location = data.location;
    if (data.date !== undefined) updateEventData.date = data.date ? new Date(data.date) : null;
    if (data.type) updateEventData.type = data.type;

    // Validate smsTemplate
    const smsTemplate = data.smsTemplate !== undefined && data.smsTemplate !== null ? data.smsTemplate : undefined;

    // Use a transaction to update event and create SMSTemplate
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update event if there are changes
      if (Object.keys(updateEventData).length > 0) {
        await tx.event.update({
          where: { id: eventId },
          data: updateEventData,
        });
      }

      // Create new SMSTemplate if provided
      if (smsTemplate !== undefined) {
        await tx.sMSTemplate.create({
          data: {
            content: smsTemplate,
            eventId: eventId,
            createdById: createdById,
            createdAt: new Date(),
          },
        });
      }

      // Update assignees
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

        const event = await tx.event.findUnique({
          where: { id: eventId },
          include: { assignees: true },
        });
        if (!event) {
          throw new Error('Event not found');
        }

        const existingAssignees = event.assignees.filter((user: User) => user.role === role);

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
                await tx.userCredential.updateMany({
                  where: { userId: existingUser.id },
                  data: { password: assignee.password }, // Note: Address plain-text storage
                });
              }
              if (Object.keys(updates).length > 0) {
                await tx.user.update({
                  where: { id: existingUser.id },
                  data: updates,
                });
              }
              return existingUser;
            } else {
              const hashedPassword = await bcrypt.hash(assignee.password, 10);
              console.log(`Creating new user for ${assignee.username} with createdById: ${createdById}`);
              const newUser = await tx.user.create({
                data: {
                  username: assignee.username,
                  password: hashedPassword,
                  phone: assignee.phone,
                  role,
                  createdById,
                  assignedEvents: { connect: { id: eventId } },
                },
              });
              await tx.userCredential.create({
                data: { userId: newUser.id, password: assignee.password }, // Note: Address plain-text storage
              });
              return newUser;
            }
          }) || [];

        const updatedUsers = (await Promise.all(assigneePromises)).filter(
          (user: User | null): user is User => user !== null
        );

        // console.log(`Updated ${role} users:`, updatedUsers.map((u: User) => u.username));

        if (removedAssigneeIds && removedAssigneeIds.length > 0) {
          console.log(`Disconnecting ${role} users with IDs:`, removedAssigneeIds);
          await tx.event.update({
            where: { id: eventId },
            data: { assignees: { disconnect: removedAssigneeIds.map((id) => ({ id })) } },
          });
        }

        return updatedUsers;
      };

      if (data.mcs || data.removedMcs) {
        await updateAssignees('MC', data.mcs || [], data.removedMcs);
      }
      if (data.deskAttendees || data.removedDeskAttendees) {
        await updateAssignees('DESK_ATTENDEE', data.deskAttendees || [], data.removedDeskAttendees);
      }
    });

    return NextResponse.json({ message: 'Event updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event', details: (error as any).message }, { status: 500 });
  }
}