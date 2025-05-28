'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';

type Donation = {
  id: number;
  donorName: string;
  donorPhone: string | null;
  giftItem: string | null;
  amount: number;
  notes: string | null;
  status: string;
  createdAt: string;
  event: { title: string };
};

export default function MCDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = Number(params.eventId);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Redirect if not MC or unauthorized
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'MC') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

 // Fetch Donations and Validate Event
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const fetchData = async () => {
      try {
        // Verify event assignment
        const eventsResponse = await fetch('/api/user/events');
        if (!eventsResponse.ok) {
          setError('Failed to fetch assigned events');
          router.push('/dashboard');
          return;
        }
        const events = await eventsResponse.json();
        if (!events.some((e: { id: number }) => e.id === eventId)) {
          setError('You are not assigned to this event');
          router.push('/dashboard');
          return;
        }

        // Fetch donations
        const donationsResponse = await fetch(`/api/donations/${eventId}`);
        if (donationsResponse.ok) {
          const data = await donationsResponse.json();
          setDonations(
            data.sort((a: Donation, b: Donation) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          )
          setEventTitle(data[0]?.event.title || 'Event');
        } else {
          setError('Failed to fetch donations');
          router.push('/dashboard');
        }
      } catch (err) {
        setError('Error fetching data');
        router.push('/dashboard');
      }
    };
    if (eventId && status === 'authenticated') {
      fetchData();
      intervalId = setInterval(fetchData, 20000);
    }
    return () => clearInterval(intervalId);
  }, [eventId, status, router]);

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

   if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

   return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 text-center sm:text-left">
        MC Dashboard - {eventTitle}
      </h1>
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm sm:text-base"
          role="grid"
          aria-label="Donations Table"
        >
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                ID
              </th>
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                Name
              </th>
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                Gift Item
              </th>
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                Amount
              </th>
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                Notes
              </th>
              <th className="p-2 sm:p-3 border text-left font-medium" scope="col">
                Created At
              </th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation, index) => (
              <tr key={donation.id} className="border-b hover:bg-gray-50">
                <td className="p-2 sm:p-3 font-mono text-sm sm:text-base text-gray-700 truncate max-w-[80px] sm:max-w-[100px]">
                  {donations.length - index}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.donorName}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.giftItem || 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
                  {donation.amount != null ? donation.amount.toFixed(2) : 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.notes || 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {new Date(donation.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}