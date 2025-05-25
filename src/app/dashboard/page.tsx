'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
    const [assignedEvents, setAssignedEvents] = useState<{ id: number }[]>([]);
    const [error, setError] = useState<string | null>(null);


      // Fetch assigned events for MC or Desk Attendee
 useEffect(() => {
    const fetchAssignedEvents = async () => {
      if (status === 'authenticated' && ['MC', 'DESK_ATTENDEE'].includes(session?.user?.role || '')) {
        try {
          const response = await fetch('/api/user/events');
          if (response.ok) {
            const events = await response.json();
            setAssignedEvents(events);
          } else {
            setError('Failed to fetch assigned events');
          }
        } catch (err) {
          setError('Error fetching events');
        }
      }
    };
    fetchAssignedEvents();
    }, [status, session]);

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
          if (assignedEvents.length > 0) {
            router.push(`/dashboard/mc/${assignedEvents[0].id}`);
          } else {
            router.push('/dashboard/no-event');
          }
          break;
        case 'DESK_ATTENDEE':
          if (assignedEvents.length > 0) {
            router.push(`/dashboard/desk-attendee/${assignedEvents[0].id}`);
          } else {
            router.push('/dashboard/no-event');
          }
          break;
        default:
          router.push('/sign-in');
      }
    }
  }, [status, session, assignedEvents, router]);

if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return <div className="text-center mt-10">Redirecting to your dashboard...</div>;
}