'use client';
import Loading from '@/components/Loading';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assignedEvents, setAssignedEvents] = useState<{ id: number; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch assigned events for MC or Desk Attendee
  useEffect(() => {
    const fetchAssignedEvents = async () => {
      if (status === 'authenticated' && ['MC', 'DESK_ATTENDEE'].includes(session?.user?.role || '')) {
        try {
          const response = await fetch('/api/user/events');
          if (response.ok) {
            const events = await response.json();
            console.log('Fetched events:', events);
            setAssignedEvents(events);
          } else {
            const errorData = await response.json();
            console.error('Failed to fetch events:', errorData);
            setError(`Failed to fetch events: ${errorData.error}`);
          }
        } catch (err) {
          console.error('Error fetching events:', err);
          setError('Error fetching events');
        }
      }
    };
    fetchAssignedEvents();
  }, [status, session]);

  // Redirect based on role and assigned events
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      console.log('Session data:', { role: session.user.role, userId: session.user.id });
      switch (session.user.role) {
        case 'ADMIN':
          router.push('/dashboard/admin');
          break;
        case 'EVENT_OWNER':
          router.push('/dashboard/event-owner');
          break;
        case 'MC':
          if (assignedEvents.length > 0) {
            if (assignedEvents.length === 1) {
              router.push(`/dashboard/mc/${assignedEvents[0].id}`);
            } else {
              router.push('/dashboard/select-event');
            }
          } else if (assignedEvents.length === 0 && error === null) {
            // Wait for fetch to complete
            break;
          } else {
            router.push('/dashboard/no-event');
          }
          break;
        case 'DESK_ATTENDEE':
          if (assignedEvents.length > 0) {
            if (assignedEvents.length === 1) {
              router.push(`/dashboard/desk-attendee/${assignedEvents[0].id}`);
            } else {
              router.push('/dashboard/select-event');
            }
          } else if (assignedEvents.length === 0 && error === null) {
            // Wait for fetch to complete
            break;
          } else {
            router.push('/dashboard/no-event');
          }
          break;
        default:
          router.push('/sign-in');
      }
    }
  }, [status, session, assignedEvents, error, router]);

  if (status === 'loading') {
    return <Loading />;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return <div className="text-center mt-10">Redirecting to your dashboard...</div>;
}