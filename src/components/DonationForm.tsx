'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DonationForm({ eventId, smsTemplate }: { eventId: number; smsTemplate?: string }) {
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(smsTemplate || '');
  const router = useRouter();

  const submitDonation = async () => {
    const response = await fetch('/api/donations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, donorName, donorPhone, amount }),
    });
    if (response.ok) {
      const smsLink = `sms:${donorPhone}?body=${encodeURIComponent(
        message
          .replace('{donorName}', donorName)
          .replace('{amount}', amount)
          .replace('{eventName}', 'Event') // Replace with actual event name
      )}`;
      window.location.href = smsLink;
      router.refresh();
    } else {
      alert('Failed to submit donation');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Log Donation</h2>
      <input
        type="text"
        value={donorName}
        onChange={(e) => setDonorName(e.target.value)}
        placeholder="Donor Name"
        className="w-full p-2 mb-4 border rounded"
      />
      <input
        type="tel"
        value={donorPhone}
        onChange={(e) => setDonorPhone(e.target.value)}
        placeholder="Donor Phone"
        className="w-full p-2 mb-4 border rounded"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-full p-2 mb-4 border rounded"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="SMS Message"
        className="w-full p-2 mb-4 border rounded"
      />
      <button
        onClick={submitDonation}
        className="w-full p-2 bg-blue-600 text-white rounded"
      >
        Submit & Send SMS
      </button>
    </div>
  );
}