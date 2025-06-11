'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useLoading } from '@/context/LoadingContext';
// import jsPDF from 'jspdf';

type Donation = {
  id: number;
  donorName: string;
  donorPhone: string | null;
  giftItem: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  donatedTo: string | null;
  status: string;
  createdAt: string;
  event: { title: string; image: string | null; };
};

type DonationWithLocalId = Donation & {
  Id: number; 
};

export default function DeskAttendeeDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = Number(params.eventId);
  const [donations, setDonations] = useState<DonationWithLocalId[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [giftItem, setGiftItem] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [notes, setNotes] = useState('');
  const [donatedTo, setDonatedTo] = useState('');
  const [sendSMS, setSendSMS] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {setLoading} = useLoading();

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
      setLoading(true);
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

      // Fetch event details to get event type
      const eventResponse = await fetch(`/api/events/${eventId}`);
      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEventType(eventData.type || 'EVENT');
      }

      // Fetch donations
      const donationsResponse = await fetch(`/api/donations/${eventId}`);
      if (donationsResponse.ok) {
        const data: Donation[] = await donationsResponse.json();
        const sortedDonations = data
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((donation, index, array) => ({
            ...donation,
            Id: array.length - index,
          }));
        setDonations(sortedDonations);
        setEventTitle(data[0]?.event.title || 'Event');
      } else {
        setError('Failed to fetch donations');
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Error fetching data');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };
  if (eventId && status === 'authenticated') {
    fetchData();
  }
}, [eventId, status, router, setLoading]);

  // Print Receipt Function
const printReceiptForDonation = (donation: Donation) => {
  const printDiv = document.createElement('div');
  printDiv.className = 'print-receipt';
  printDiv.style.position = 'absolute';
  printDiv.style.top = '-9999px';
  printDiv.style.left = '-9999px';
  printDiv.style.width = '80mm';
  printDiv.style.padding = '5mm';
  printDiv.style.fontFamily = "'Arial', sans-serif";
  printDiv.style.backgroundColor = '#ffffff';
  printDiv.style.color = '#000000';

  const style = document.createElement('style');
  style.textContent = `
    @media print {
      body * { visibility: hidden; }
      .print-receipt, .print-receipt * { visibility: visible; }
      .print-receipt {
        position: static;
        width: 80mm;
        font-size: 10pt;
        page-break-after: always;
        margin: 0;
        padding: 5mm;
      }
      .receipt-image {
        width: 30mm;
        height: 30mm;
        object-fit: contain;
        display: block;
        margin: 3mm auto;
      }
      .receipt-content {
        text-align: center;
      }
      @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Preload the image to ensure it loads before printing
  const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve();
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        reject(new Error(`Failed to load image: ${src}`));
      };
    });
  };

  // Generate receipt HTML
  printDiv.innerHTML = `
    <div style="display: flex; flex-direction: column; height: 100%;">
      <header style="text-align: center; margin-bottom: 3mm;">
        <h1 style="font-size: 12pt; font-weight: bold; margin: 0; text-transform: uppercase;">
          ${eventType} RECEIPT
        </h1>
      </header>
      <main>
        ${
          donation.event.image
            ? `<img src="${donation.event.image}" class="receipt-image" style="width: 30mm; height: 30mm; object-fit: contain;" onerror="console.error('Image failed to load in receipt: ${donation.event.image}')" />`
            : `<div style="width: 20mm; height: 20mm; margin: 3mm auto;"></div>`
        }
        <div class="receipt-content">
          <h2 style="font-size: 14pt; font-family: 'Georgia', serif; font-weight: bold; margin: 3mm 0;">
            ${eventTitle}
          </h2>
          <p style="font-size: 9pt; margin: 1mm 0;">${donation.donorName}</p>
          ${donation.giftItem ? `<p style="font-size: 9pt; margin: 1mm 0;">Gift: ${donation.giftItem}</p>` : ''}
          ${donation.amount != null && donation.currency ? `
            <p style="font-size: 9pt; margin: 1mm 0;">
              Donation: ${donation.currency} ${donation.amount.toFixed(2)}
            </p>` : ''}
          ${donation.donatedTo ? `<p style="font-size: 9pt; margin: 1mm 0;">To: ${donation.donatedTo}</p>` : ''}
          <p style="font-size: 9pt; margin: 1mm 0;">
            ${new Date(donation.createdAt).toLocaleString()}
          </p>
        </div>
      </main>
      <footer style="text-align: center; margin-top: 5mm;">
        <p style="font-size: 9pt; font-style: italic; margin: 0;">
          MAY GOD RICHLY BLESS YOU!
        </p>
      </footer>
    </div>
  `;

  // Append to document
  document.body.appendChild(printDiv);

  // Wait for image to load before printing
  const print = () => {
    window.print();
    document.body.removeChild(printDiv);
    document.head.removeChild(style);
  };

  if (donation.event.image) {
    preloadImage(donation.event.image)
      .then(() => {
        setTimeout(print, 200);
      })
      .catch((error) => {
        console.error(error);
        setTimeout(print, 200);
      });
  } else {
    setTimeout(print, 200);
  }
};

  // Create Donation
  const createDonation = async () => {
    if (!donorName) {
      alert('Donor Name is required');
      return;
    }

    // Validate amount
  const parsedAmount = amount ? Number.parseFloat(amount) : null;
  if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount < 0)) {
    alert('Please enter a valid amount');
    return;
  }

    try {
      setLoading(true);
      const response = await fetch(`/api/donations/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName,
          donorPhone,
          giftItem,
          amount: parsedAmount ? Number(parsedAmount.toFixed(2)) : null,
          currency: currency || null,
          notes,
          donatedTo: donatedTo || null,
          sendSMS,
        }),
      });

        if (response.ok) {
        const { donation, smsTemplate } = await response.json();
        if (sendSMS && donorPhone && smsTemplate) {
          let smsMessage = smsTemplate;

          // Replace placeholders with values or remove them if missing
          smsMessage = smsMessage.replace('{donorName}', donorName); 
          smsMessage = smsMessage.replace('{eventName}', eventTitle);

          // Handle optional fields
          if (parsedAmount) {
            smsMessage = smsMessage.replace('{amount}', `${currency} ${parsedAmount.toFixed(2)}`);
          } else {
            smsMessage = smsMessage.replace(' {amount}', '').replace('{amount}', '');
          }

          if (giftItem) {
            smsMessage = smsMessage.replace('{gift}', giftItem);
          } else {
            smsMessage = smsMessage.replace(' {gift}', '').replace('{gift}', '');
          }

          if (donation.donatedTo) {
            smsMessage = smsMessage.replace('{target}', donation.donatedTo);
          } else {
            smsMessage = smsMessage.replace(' {target}', '').replace('{target}', '');

            // Clean up any leftover punctuation or spaces
            smsMessage = smsMessage
              .replace(/\s{2,}/g, ' ')
              .replace(/,\s*,/g, ',') 
              .replace(/,\s*$/, '')
              .trim();
          }

          const smsLink = `sms:${donorPhone}?body=${encodeURIComponent(smsMessage)}`;
          if (confirm(`Send SMS to ${donorPhone}?`)) {
            window.location.href = smsLink;
          }
        }
        if (printReceipt) {
          printReceiptForDonation(donation);
        }
        // Refresh donations
        const updatedDonationsResponse = await fetch(`/api/donations/${eventId}`);
        const updatedDonations: Donation[] = await updatedDonationsResponse.json();
        // Sort and assign local IDs
        const sortedDonations = updatedDonations
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((donation, index, array) => ({
            ...donation,
            Id: array.length - index,
          }));
        setDonations(sortedDonations);
        setDonorName('');
        setDonorPhone('');
        setGiftItem('');
        setAmount('');
        setCurrency('GHS');
        setNotes('');
        setDonatedTo('');
        setSendSMS(false);
        setPrintReceipt(false); 
        alert('Donation created successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to create donation: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.log('Error creating donation', err)
      alert('Error creating donation');
    }
    finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return null;
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
              Donated To
            </label>
            <input
              type="text"
              value={donatedTo}
              onChange={(e) => setDonatedTo(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              aria-label="Donated To"
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

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col flex-1">
              <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01" // Allow up to 2 decimal places
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                aria-label="Donation Amount"
                inputMode='decimal'
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full"
                aria-label="Currency"
              >
                <option value="GHS">GHS - Ghanaian Cedi</option>
                <option value="USD">USD - US Dollar</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
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
          

          <div className="flex flex-col gap-2 sm:gap-3">
            <label className="flex items-center text-sm sm:text-base">
              <input
                type="checkbox"
                checked={sendSMS}
                onChange={(e) => setSendSMS(e.target.checked)}
                className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 focus:ring-blue-500"
                aria-label="Send Donor SMS"
              />
              <span className="ml-2">Send Donor SMS</span>
            </label>
            <label className="flex items-center text-sm sm:text-base">
              <input
                type="checkbox"
                checked={printReceipt}
                onChange={(e) => setPrintReceipt(e.target.checked)}
                className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 focus:ring-blue-500"
                aria-label="Print Receipt"
              />
              <span className="ml-2">Print Receipt</span>
            </label>
          </div>

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
              <th className="p-2 sm:p-3 border text-left font-medium">Id</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Name</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Phone</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Gift Item</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Amount</th>
              <th className="p-2 sm:p-3 border text-left font-medium">To</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Notes</th>
              {/* <th className="p-2 sm:p-3 border text-left font-medium">Status</th> */}
              <th className="p-2 sm:p-3 border text-left font-medium">Created At</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation.id} className="border-b hover:bg-gray-50">
                 <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.Id}
                </td>
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
                {donation.amount != null ? `${donation.currency || 'GHS'} ${donation.amount.toFixed(2)}` : 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                {donation.donatedTo || 'N/A'}
                </td> 
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {donation.notes || 'N/A'}
                </td>
                {/* <td className="p-2 sm:p-3 truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
                  {donation.status}
                </td> */}
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