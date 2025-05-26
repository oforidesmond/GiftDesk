import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Secure the endpoint with a secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find expired EVENT_OWNER users
    const expiredUsers = await prisma.user.findMany({
      where: {
        role: 'EVENT_OWNER',
        expiresAt: {
          lte: new Date(),
          not: null,
        },
      },
      select: { id: true },
    });

    // Delete users and related data
    for (const user of expiredUsers) {
      await prisma.$transaction([
        // Delete UserCredential
        prisma.userCredential.deleteMany({
          where: { userId: user.id },
        }),
        // Delete SMSTemplates
        prisma.sMSTemplate.deleteMany({
          where: { createdById: user.id },
        }),
        // Delete Donations
        prisma.donation.deleteMany({
          where: { createdById: user.id },
        }),
        // Delete Events (and their donations, smsTemplates)
        prisma.event.deleteMany({
          where: { createdById: user.id },
        }),
        // Delete created users
        prisma.user.deleteMany({
          where: { createdById: user.id },
        }),
        // Delete the user
        prisma.user.delete({
          where: { id: user.id },
        }),
      ]);
    }

    return NextResponse.json({ message: `Deleted ${expiredUsers.length} expired Event Owners` });
  } catch (error) {
    console.error('Error deleting expired users:', error);
    return NextResponse.json({ error: 'Failed to delete expired users' }, { status: 500 });
  }
}