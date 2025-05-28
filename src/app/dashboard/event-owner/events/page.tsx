'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

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
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-gray-100 rounded-lg shadow-md text-black">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 text-center sm:text-left">
        All Events
      </h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm sm:text-base">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 sm:p-3 border text-left font-medium">Title</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Location</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Date</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Type</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b hover:bg-gray-50">
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.title}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.location || 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.date ? new Date(event.date).toLocaleString() : 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.type}
                </td>
                <td className="p-2 sm:p-3 flex gap-2 sm:gap-3 items-center">
                  <button
                    className="p-1 sm:p-2 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label={`Edit event ${event.title}`}
                  >
                    <PencilSquareIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <button
                    className="p-1 sm:p-2 text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label={`Delete event ${event.title}`}
                  >
                    <TrashIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}