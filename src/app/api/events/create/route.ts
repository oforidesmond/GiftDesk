import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcrypt';
import { put } from '@vercel/blob';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing
  },
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const createdById = Number(session.user.id);
  if (isNaN(createdById)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  let imagePath: string | null = null;

  try {
    // Parse form data
    const formData = await request.formData().catch((err) => {
      throw new Error(`Failed to parse form data: ${err.message || 'Unknown error'}`);
    });

    // Extract and validate fields
    const title = formData.get('title') as string;
    const location = (formData.get('location') as string) || null;
    const date = (formData.get('date') as string) || null;
    const type = formData.get('type') as string;
    const smsTemplate = (formData.get('smsTemplate') as string) || undefined;
    let mcs: { username: string; password: string; phone: string }[] = [];
    let deskAttendees: { username: string; password: string; phone: string }[] = [];

    // Parse JSON fields
    try {
      const mcsRaw = formData.get('mcs') as string;
      if (mcsRaw) {
        mcs = JSON.parse(mcsRaw);
        if (!Array.isArray(mcs)) {
          throw new Error('MCs must be an array');
        }
      }
      const deskAttendeesRaw = formData.get('deskAttendees') as string;
      if (deskAttendeesRaw) {
        deskAttendees = JSON.parse(deskAttendeesRaw);
        if (!Array.isArray(deskAttendees)) {
          throw new Error('Desk Attendees must be an array');
        }
      }
    } catch (err: any) {
      throw new Error(`Invalid JSON in mcs or deskAttendees: ${err.message}`);
    }

    // Validate required fields
     if (!title?.trim() || !type?.trim()) {
      return NextResponse.json({ error: 'Missing required fields: title and type are required' }, { status: 400 });
    }

    // Validate MCs and Desk Attendees
  for (const mc of mcs) {
      if (!mc.username?.trim() || !mc.password?.trim()) {
        throw new Error('Each MC must have a username and password');
      }
    }
    for (const attendee of deskAttendees) {
      if (!attendee.username?.trim() || !attendee.password?.trim()) {
        throw new Error('Each Desk Attendee must have a username and password');
      }
    }

    // Handle image file
    const imageFile = formData.get('image') as File | null;
    if (imageFile) {
      // Validate file type
      if (!imageFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
      }
      // Validate file size (5MB max)
      if (imageFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image file too large. Max 5MB.' }, { status: 400 });
      }
      if (imageFile.size === 0) {
        return NextResponse.json({ error: 'Image file is empty.' }, { status: 400 });
      }
      const extension = path.extname(imageFile.name || '.jpg');
      const filename = `${uuidv4()}${extension}`;
       try {
        const { url } = await put(`events/${filename}`, await imageFile.arrayBuffer(), {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }); // Upload to Vercel Blob
        imagePath = url; // Store Blob URL
      } catch (err: any) {
        throw new Error(`Failed to upload image to Vercel Blob: ${err.message || 'Unknown error'}`);
      }
    }

    // Create event and related data in a transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Create event
        const event = await tx.event.create({
          data: {
            title,
            location,
            date: date ? new Date(date) : null,
            type,
            image: imagePath,
            createdById,
          },
        }).catch((err) => {
          throw new Error(`Failed to create event: ${err.message || 'Unknown error'}`);
        });

        // Assign creator to the event
        await tx.user
          .update({
            where: { id: createdById },
            data: {
              assignedEvents: {
                connect: { id: event.id },
              },
            },
          })
          .catch((err) => {
            throw new Error(`Failed to assign creator to event: ${err.message || 'Unknown error'}`);
          });

        // Create SMS Template if provided
        let createdTemplate = null;
        if (smsTemplate) {
          const existingTemplate = await tx.sMSTemplate.findFirst({
            where: { eventId: event.id },
          });
          if (!existingTemplate) {
            createdTemplate = await tx.sMSTemplate
              .create({
                data: {
                  eventId: event.id,
                  content: smsTemplate,
                  createdById,
                },
              })
              .catch((err) => {
                throw new Error(`Failed to create SMS template: ${err.message || 'Unknown error'}`);
              });
          }
        }

        // Create MCs if provided and non-empty
        const createdMcs = await Promise.all(
          mcs.map(async (mc: { username: string; password: string; phone: string }) => {
            const hashedPassword = await bcrypt.hash(mc.password, 10);
            const user = await tx.user
              .create({
                data: {
                  username: mc.username,
                  password: hashedPassword,
                  phone: mc.phone || null,
                  role: 'MC',
                  createdById,
                  sentCredentials: false,
                  assignedEvents: { connect: { id: event.id } },
                },
              })
              .catch((err) => {
                throw new Error(`Failed to create MC user: ${err.message || 'Unknown error'}`);
              });
            await tx.userCredential
              .create({
                data: {
                  userId: user.id,
                  password: mc.password, // Note: Address plain-text storage
                },
              })
              .catch((err) => {
                throw new Error(`Failed to create MC credential: ${err.message || 'Unknown error'}`);
              });
            return { id: user.id, username: mc.username, password: mc.password, phone: mc.phone, role: 'MC' };
          })
        );

        // Create Desk Attendees if provided and non-empty
        const createdAttendees = await Promise.all(
          deskAttendees.map(async (attendee: { username: string; password: string; phone: string }) => {
            const hashedPassword = await bcrypt.hash(attendee.password, 10);
            const user = await tx.user
              .create({
                data: {
                  username: attendee.username,
                  password: hashedPassword,
                  phone: attendee.phone || null,
                  role: 'DESK_ATTENDEE',
                  createdById,
                  sentCredentials: false,
                  assignedEvents: { connect: { id: event.id } },
                },
              })
              .catch((err) => {
                throw new Error(`Failed to create Desk Attendee user: ${err.message || 'Unknown error'}`);
              });
            await tx.userCredential
              .create({
                data: {
                  userId: user.id,
                  password: attendee.password, // Note: Address plain-text storage
                },
              })
              .catch((err) => {
                throw new Error(`Failed to create Desk Attendee credential: ${err.message || 'Unknown error'}`);
              });
            return {
              id: user.id,
              username: attendee.username,
              password: attendee.password,
              phone: attendee.phone,
              role: 'DESK_ATTENDEE',
            };
          })
        );

        return { event, createdTemplate, createdMcs, createdAttendees };
      },
      { timeout: 10000 } // Increase transaction timeout if needed
    );

    return NextResponse.json(
      {
        event: result.event,
        mcs: result.createdMcs,
        deskAttendees: result.createdAttendees,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Enhanced error handling to avoid null errors
    const errorMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack : 'No stack trace available';

    console.error('Error creating event:', {
      message: errorMessage,
      details: errorDetails,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      formDataKeys: request.formData ? Array.from((await request.formData()).keys()) : 'FormData not parsed',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });

    return NextResponse.json(
      { error: 'Failed to create event', details: errorMessage },
      { status: 500 }
    );
  }
}