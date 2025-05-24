'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      switch (session.user.role) {
        case 'ADMIN':
          router.push('/dashboard/admin');
          break;
        case 'EVENT_OWNER':
          router.push('/dashboard/event-owner');
          break;
        case 'MC':
          router.push('/dashboard/mc');
          break;
        case 'DESK_ATTENDEE':
          router.push('/dashboard/desk-attendee');
          break;
        default:
          router.push('/sign-in');
      }
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return <div className="text-center mt-10">Redirecting to your dashboard...</div>;
}