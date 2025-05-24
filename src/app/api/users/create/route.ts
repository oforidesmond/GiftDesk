import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { username, password, phone, role, expiresAt } = await request.json();

  if (!username || !password || !phone || role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        phone,
        role,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: Number(session.user.id),
      },
    });
    return NextResponse.json({ username, password }); // Return credentials for SMS
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}