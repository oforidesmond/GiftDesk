'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SelectEvent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<{ id: number, title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not MC or Desk Attendee
  useEffect(() => {
    if (status === 'authenticated' && !['MC', 'DESK_ATTENDEE'].includes(session?.user?.role || '')) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch assigned events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/user/events');
        if (response.ok) {
          const data = await response.json();
          console.log('Events for selection:', data);
          setEvents(data);
          if (data.length === 0) {
            router.push('/dashboard/no-event');
          } else if (data.length === 1) {
            router.push(`/dashboard/${session?.user?.role === 'MC' ? 'mc' : 'desk-attendee'}/${data[0].id}`);
          }
        } else {
          const errorData = await response.json();
          setError(`Failed to fetch events: ${errorData.error}`);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Error fetching events');
      }
    };
    if (status === 'authenticated') {
      fetchEvents();
    }
  }, [status, session, router]);

  // Handle event selection
  const selectEvent = (eventId: number) => {
    const path = session?.user?.role === 'MC' ? 'mc' : 'desk-attendee';
    router.push(`/dashboard/${path}/${eventId}`);
  };

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-2xl font-bold mb-6">Select an Event</h1>
      {events.length === 0 ? (
        <p className="text-center">No events assigned.</p>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => selectEvent(event.id)}
              className="p-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-left"
            >
              {event.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}