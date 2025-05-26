'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';

type Donation = {
  id: number;
  donorName: string;
  donorPhone: string | null;
  giftItem: string | null;
  amount: number | null;
  notes: string | null;
  status: string;
  createdAt: string;
  event: { title: string };
};

export default function DeskAttendeeDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = Number(params.eventId);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [giftItem, setGiftItem] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [sendSMS, setSendSMS] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not Desk Attendee or unauthorized
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'DESK_ATTENDEE') {
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

  // Create Donation
  const createDonation = async () => {
    if (!donorName) {
      alert('Donor Name is required');
      return;
    }

    try {
      const response = await fetch(`/api/donations/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName,
          donorPhone,
          giftItem,
          amount: amount ? parseFloat(amount) : null,
          notes,
          sendSMS,
        }),
      });

      if (response.ok) {
        const { donation, smsTemplate } = await response.json();
        if (sendSMS && donorPhone && smsTemplate) {
          const smsMessage = smsTemplate
            .replace('{donorName}', donorName)
            .replace('{amount}', amount || 'N/A')
            .replace('{eventName}', eventTitle);
          const smsLink = `sms:${donorPhone}?body=${encodeURIComponent(smsMessage)}`;
          if (confirm(`Send SMS to ${donorPhone}?`)) {
            window.location.href = smsLink;
          }
        }
        // Refresh donations
        const updatedDonations = await (await fetch(`/api/donations/${eventId}`)).json();
        setDonations(updatedDonations);
        setDonorName('');
        setDonorPhone('');
        setGiftItem('');
        setAmount('');
        setNotes('');
        setSendSMS(false);
        alert('Donation created successfully!');
      } else {
        alert('Failed to create donation');
      }
    } catch (err) {
      alert('Error creating donation');
    }
  };

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-2xl font-bold mb-6">Desk Attendee Dashboard - {eventTitle}</h1>

      {/* Create Donation Form */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add Donation</h2>
        <div className="grid gap-4">
          <input
            type="text"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Donor Name"
            className="p-2 border rounded"
          />
          <input
            type="tel"
            value={donorPhone}
            onChange={(e) => setDonorPhone(e.target.value)}
            placeholder="Donor Phone (e.g., +2341234567890)"
            className="p-2 border rounded"
          />
          <input
            type="text"
            value={giftItem}
            onChange={(e) => setGiftItem(e.target.value)}
            placeholder="Gift Item"
            className="p-2 border rounded"
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="p-2 border rounded"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="p-2 border rounded"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendSMS}
              onChange={(e) => setSendSMS(e.target.checked)}
              className="h-4 w-4"
            />
            Send SMS Confirmation
          </label>
          <button
            onClick={createDonation}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Donation
          </button>
        </div>
      </div>

      {/* Donations Table */}
      <h2 className="text-xl font-semibold mb-4">Donations</h2>
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
              <td className="p-2">{donation.amount != null ? donation.amount.toFixed(2) : 'N/A'}</td>
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