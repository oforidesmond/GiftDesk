import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { put, del } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import path from 'path';

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

export const config = {
  api: {
    bodyParser: false,
  },
};

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
        image: true,
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
  const createdById = parseInt(session.user.id);
  if (isNaN(createdById)) {
    console.error('Invalid session.user.id:', session.user.id);
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  // Verify event exists and belongs to creator
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId, createdById },
    select: { image: true },
  });
  if (!existingEvent) {
    return NextResponse.json({ error: 'Event not found or unauthorized' }, { status: 404 });
  }

  let imagePath: string | null = existingEvent.image;

  try {
    // Parse form data
    const formData = await request.formData().catch((err) => {
      throw new Error(`Failed to parse form data: ${err.message || 'Unknown error'}`);
    });

    // Extract fields
    const title = formData.get('title') as string;
    const location = (formData.get('location') as string) || null;
    const date = (formData.get('date') as string) || null;
    const type = formData.get('type') as string;
    const smsTemplate = (formData.get('smsTemplate') as string) || undefined;
    let mcs: { id?: number; username: string; password?: string; phone: string }[] = [];
    let deskAttendees: { id?: number; username: string; password?: string; phone: string }[] = [];
    let removedMcs: number[] = [];
    let removedDeskAttendees: number[] = [];

    // Parse JSON fields with safety checks
    const parseJsonField = <T>(field: string | null): T | undefined => {
      if (!field || field === 'undefined' || field === '') return undefined;
      try {
        return JSON.parse(field);
      } catch (err: any) {
        throw new Error(`Invalid JSON in ${field}: ${err.message}`);
      }
    };

    mcs = parseJsonField(formData.get('mcs') as string) || [];
    deskAttendees = parseJsonField(formData.get('deskAttendees') as string) || [];
    removedMcs = parseJsonField(formData.get('removedMcs') as string) || [];
    removedDeskAttendees = parseJsonField(formData.get('removedDeskAttendees') as string) || [];

    // Validate array fields
    if (mcs && !Array.isArray(mcs)) throw new Error('MCs must be an array');
    if (deskAttendees && !Array.isArray(deskAttendees)) throw new Error('Desk Attendees must be an array');
    if (removedMcs && !Array.isArray(removedMcs)) throw new Error('Removed MCs must be an array');
    if (removedDeskAttendees && !Array.isArray(removedDeskAttendees))
      throw new Error('Removed Desk Attendees must be an array');

    // Validate required fields
    if (!title?.trim() || !type?.trim()) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
    }

    // Handle image file (unchanged)
    const imageAction = formData.get('imageAction') as string | null;
    if (imageAction === 'remove') {
      if (existingEvent.image) {
        await del(existingEvent.image).catch((err) => {
          console.error('Failed to delete image from Vercel Blob:', err);
        });
      }
      imagePath = null;
    } else {
      const imageFile = formData.get('image') as File | null;
      if (imageFile && imageFile.size > 0) {
        if (!imageFile.type.startsWith('image/')) {
          return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
        }
        if (imageFile.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'Image file too large. Max 5MB.' }, { status: 400 });
        }
        const extension = path.extname(imageFile.name || '.jpg');
        const filename = `${uuidv4()}${extension}`;
        try {
          const { url } = await put(`events/${filename}`, await imageFile.arrayBuffer(), {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          imagePath = url;
          if (existingEvent.image) {
            await del(existingEvent.image).catch((err) => {
              console.error('Failed to delete old image:', err);
            });
          }
        } catch (err: any) {
          throw new Error(`Failed to upload image to Vercel Blob: ${err.message || 'Unknown error'}`);
        }
      }
    }

    // Update event and related data in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update event
      const updateEventData: any = {
        title,
        location,
        date: date ? new Date(date) : null,
        type,
        image: imagePath,
      };
      const event = await tx.event.update({
        where: { id: eventId },
        data: updateEventData,
      });

      // Update or create SMS Template
      if (smsTemplate !== undefined) {
        const existingTemplate = await tx.sMSTemplate.findFirst({
          where: { eventId },
          orderBy: { createdAt: 'desc' },
        });
        if (existingTemplate && smsTemplate) {
          await tx.sMSTemplate.update({
            where: { id: existingTemplate.id },
            data: { content: smsTemplate },
          });
        } else if (smsTemplate) {
          await tx.sMSTemplate.create({
            data: {
              content: smsTemplate,
              eventId,
              createdById,
              createdAt: new Date(),
            },
          });
        }
      }

      // Update assignees
      const updateAssignees = async (
        role: 'MC' | 'DESK_ATTENDEE',
        newAssignees: { id?: number; username: string; password?: string; phone: string }[] | undefined,
        removedAssigneeIds: number[] | undefined
      ) => {
        const event = await tx.event.findUnique({
          where: { id: eventId },
          include: { assignees: true },
        });
        if (!event) throw new Error('Event not found');

        const existingAssignees = event.assignees.filter((user: User) => user.role === role);

        const assigneePromises = newAssignees
          ?.filter((assignee) => assignee && assignee.username)
          .map(async (assignee) => {
            if (!assignee) return null;

            const existingUser = assignee.id
              ? existingAssignees.find((u: User) => u.id === assignee.id)
              : existingAssignees.find((u: User) => u.username === assignee.username);

            if (existingUser) {
              const updates: any = {};
              if (assignee.phone !== existingUser.phone) updates.phone = assignee.phone;
              if (assignee.username !== existingUser.username) updates.username = assignee.username;
              if (assignee.password && assignee.password.trim()) {
                updates.password = await bcrypt.hash(assignee.password, 10);
                await tx.userCredential.updateMany({
                  where: { userId: existingUser.id },
                  data: { password: assignee.password },
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
              const hashedPassword = await bcrypt.hash(assignee.password || '', 10);
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
                data: { userId: newUser.id, password: assignee.password || '' },
              });
              return newUser;
            }
          }) || [];

        const updatedUsers = (await Promise.all(assigneePromises)).filter(
          (user: User | null): user is User => user !== null
        );

        if (removedAssigneeIds && removedAssigneeIds.length > 0) {
          await tx.event.update({
            where: { id: eventId },
            data: { assignees: { disconnect: removedAssigneeIds.map((id) => ({ id })) } },
          });
        }

        return updatedUsers;
      };

      await updateAssignees('MC', mcs, removedMcs);
      await updateAssignees('DESK_ATTENDEE', deskAttendees, removedDeskAttendees);

      return event;
    });

    return NextResponse.json({ message: 'Event updated successfully', event: result }, { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack : 'No stack trace available';

    console.error('Error updating event:', {
      message: errorMessage,
      details: errorDetails,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      eventId,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });

    return NextResponse.json({ error: 'Failed to update event', details: errorMessage }, { status: 500 });
  }
}