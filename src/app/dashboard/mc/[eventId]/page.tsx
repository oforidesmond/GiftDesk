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
          setDonations(data);
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
    }
  }, [eventId, status, router]);

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

   if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-2xl font-bold mb-6">MC Dashboard - {eventTitle}</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Donor Name</th>
            <th className="p-2 border">Donor Phone</th>
            <th className="p-2 border">Gift Item</th>
            <th className="p-2 border">Amount</th>
            <th className="p-2 border">Notes</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Created At</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => (
            <tr key={donation.id} className="border-b">
              <td className="p-2">{donation.donorName}</td>
              <td className="p-2">{donation.donorPhone || 'N/A'}</td>
              <td className="p-2">{donation.giftItem || 'N/A'}</td>
              <td className="p-2">{donation.amount.toFixed(2)}</td>
              <td className="p-2">{donation.notes || 'N/A'}</td>
              <td className="p-2">{donation.status}</td>
              <td className="p-2">{new Date(donation.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}