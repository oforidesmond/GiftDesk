// src/app/api/user/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  // Log session for debugging
  console.log('Session:', session);
  
  if (!session || !session.user || !session.user.id) {
    console.error('Invalid or missing session/user data');
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid session' }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    
    // Validate userId
    if (isNaN(userId)) {
      console.error('Invalid user ID:', session.user.id);
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

   const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        expiresAt: true,
        smsTemplates: {
          orderBy: { createdAt: 'desc' }, 
          take: 1,
          select: { content: true }, 
        },
      },
    });

    // Check if user exists
    if (!user) {
      console.error('User not found for ID:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Extract smsTemplate, default to empty string
    const smsTemplate = user.smsTemplates.length > 0 ? user.smsTemplates[0].content || '' : '';

    return NextResponse.json({
      expiresAt: user.expiresAt,
      smsTemplate,
    });
  } catch (error) {
  const errorDetails = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    userId: session.user.id,
  } : {
    message: 'Unknown error',
    stack: 'No stack trace available',
    userId: session.user.id,
  };
  console.error('Error fetching user data:', errorDetails);
  return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
}
}