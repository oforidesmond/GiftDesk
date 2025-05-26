'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Event = {
  id: number;
  title: string;
  location: string | null;
  date: string | null;
  type: string;
};

export default function AllEvents() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'EVENT_OWNER') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchEvents = async () => {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    };
    fetchEvents();
  }, []);

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-2xl font-bold mb-6">All Events</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Title</th>
            <th className="p-2 border">Location</th>
            <th className="p-2 border">Date</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b">
              <td className="p-2">{event.title}</td>
              <td className="p-2">{event.location || 'N/A'}</td>
              <td className="p-2">
                {event.date ? new Date(event.date).toLocaleString() : 'N/A'}
              </td>
              <td className="p-2">{event.type}</td>
              <td className="p-2">
                <button className="text-blue-600 mr-2">Edit</button>
                <button className="text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}