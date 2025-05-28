'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Loading from '@/components/Loading';

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
    return <Loading />;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-600">{error}</div>;
  }

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-gray-100 rounded-lg shadow-md text-black">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 text-center sm:text-left">
        Gift Table - {eventTitle}
      </h1>

      {/* Create Donation Form */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4 text-center sm:text-left">
          Add Donation
        </h2>
        <div className="grid gap-4 sm:gap-5">
          <div className="flex flex-col">
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
              Donor Name
            </label>
            <input
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              aria-label="Donor Name"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
              Donor Phone (e.g., +233241298861)
            </label>
            <input
              type="tel"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              aria-label="Donor Phone"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
              Gift Item
            </label>
            <input
              type="text"
              value={giftItem}
              onChange={(e) => setGiftItem(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              aria-label="Gift Item"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              min={1}
              onChange={(e) => setAmount(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              aria-label="Donation Amount"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-h-[80px] sm:min-h-[100px]"
              aria-label="Donation Notes"
            />
          </div>

          <label className="flex items-center text-sm sm:text-base gap-2 sm:gap-3">
            <input
              type="checkbox"
              checked={sendSMS}
              onChange={(e) => setSendSMS(e.target.checked)}
              className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 focus:ring-blue-500"
              aria-label="Send Donor SMS"
            />
            Send Donor SMS
          </label>
          <button
            onClick={createDonation}
            className="p-2 sm:p-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors duration-200"
            aria-label="Add Donation"
          >
            Add Donation
          </button>
        </div>
      </div>

      {/* Donations Table */}
      <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-4 text-center sm:text-left">
        Donations
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm sm:text-base">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 sm:p-3 border text-left font-medium">Name</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Phone</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Gift Item</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Amount</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Notes</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Status</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Created At</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation.id} className="border-b hover:bg-gray-50">
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.donorName}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.donorPhone || 'N/A'}
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
                <td className="p-2 sm:p-3 truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
                  {donation.status}
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