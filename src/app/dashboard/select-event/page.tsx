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
    <div
      className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-gray-100 rounded-lg shadow-md text-black"
      role="region"
      aria-label="Event Selection"
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 text-center sm:text-left">
        Select an Event
      </h1>
      {events.length === 0 ? (
        <p className="text-sm sm:text-base md:text-lg text-center leading-relaxed">
          No events assigned.
        </p>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => selectEvent(event.id)}
              className="p-3 sm:p-4 bg-gray-600 text-white text-sm sm:text-base rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left transition-colors duration-200"
              aria-label={`Select event: ${event.title}`}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}