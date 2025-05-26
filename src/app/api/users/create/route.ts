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

  const { username, password, phone, role, expiresInDays } = await request.json();

  if (!username || !password || !phone || role !== 'EVENT_OWNER') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (typeof expiresInDays === 'number' && expiresInDays > 0) {
    const now = new Date();
    now.setDate(now.getDate() + expiresInDays);
    expiresAt = now;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        phone,
        role,
        expiresAt,
        createdById: Number(session.user.id),
      },
    });
    return NextResponse.json({ username, password }); // Return credentials for SMS
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}