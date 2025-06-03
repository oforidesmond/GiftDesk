'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// import Loading from '@/components/Loading';
import { useLoading } from '@/context/LoadingContext';

type Assignee = {
  id: number;
  username: string;
  password: string;
  phone: string;
  role: string;
  sentCredentials: boolean;
  event: { id: number; title: string };
};

type Event = {
  id: number;
  title: string;
  createdAt?: string;
};

type EventWithLocalId = Event & {
  Id: number; // New local ID field
};

type Donation = {
  id: number;
  donorName: string;
  donorPhone: string | null;
  giftItem: string | null;
  donatedTo: string | null;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  event: { title: string };
};

export default function EventOwnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
    const { setLoading } = useLoading();
  const [showModal, setShowModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [smsTemplate, setSmsTemplate] = useState('');
  const [mcs, setMcs] = useState([{ username: '', password: '', phone: '' }]);
  const [deskAttendees, setDeskAttendees] = useState([{ username: '', password: '', phone: '' }]);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [events, setEvents] = useState<EventWithLocalId[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
    const [error, setError] = useState('');

  // Redirect if not Event Owner
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'EVENT_OWNER') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch Events, Assignees, and User Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch events
        const eventsResponse = await fetch('/api/events');
        if (eventsResponse.ok) {
          const eventsData: Event[]  = await eventsResponse.json();
          const sortedEvents = eventsData
            .sort((a, b) => {
              // Sort by createdAt if available, otherwise by id
              if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              return b.id - a.id; // Fallback to database ID
            })
            .map((event, index) => ({
              ...event,
              Id: index + 1, // Assign local ID (1, 2, 3, ...)
            }));
          setEvents(sortedEvents);
          if (eventsData.length > 0 && !selectedEventId) {
            setSelectedEventId(eventsData[0].id);
          }
        } else {
        console.error('Failed to fetch events:', await eventsResponse.json());
      }

        // Fetch assignees
        const assigneesResponse = await fetch('/api/roles/list');
        if (assigneesResponse.ok) {
          const assigneesData = await assigneesResponse.json();
          setAssignees(assigneesData);
        } else {
        console.error('Failed to fetch assignees:', await assigneesResponse.json());
      }

        // Fetch user expiresAt
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setExpiresAt(userData.expiresAt);
          setSmsTemplate(userData.smsTemplate || '');
        } else {
        console.error('Failed to fetch user data:', await userResponse.json());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Countdown Timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiration = new Date(expiresAt);
      const diff = expiration.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Add MC
  const addMc = () => {
    setMcs([...mcs, { username: '', password: '', phone: '' }]);
  };

  // Add Desk Attendee
  const addDeskAttendee = () => {
    setDeskAttendees([...deskAttendees, { username: '', password: '', phone: '' }]);
  };

  // Remove MC
  const removeMc = (index: number) => {
    setMcs(mcs.filter((_, i) => i !== index));
  };

  // Remove Desk Attendee
  const removeDeskAttendee = (index: number) => {
    setDeskAttendees(deskAttendees.filter((_, i) => i !== index));
  };

  // Update MC fields
  const updateMc = (index: number, field: string, value: string) => {
    const updatedMcs = [...mcs];
    updatedMcs[index] = { ...updatedMcs[index], [field]: value };
    setMcs(updatedMcs);
  };

  // Update Desk Attendee fields
  const updateDeskAttendee = (index: number, field: string, value: string) => {
    const updatedAttendees = [...deskAttendees];
    updatedAttendees[index] = { ...updatedAttendees[index], [field]: value };
    setDeskAttendees(updatedAttendees);
  };

  // Create Event
  const createEvent = async () => {
    setError('');
    try {
      setLoading(true);
      // Filter valid MCs and Desk Attendees
      const validMcs = mcs.filter(mc => mc.username.trim() && mc.password.trim());
      const validAttendees = deskAttendees.filter(attendee => attendee.username.trim() && attendee.password.trim());

      // Validate required fields
      if (!eventTitle.trim() || !eventType) {
        setError('Event title and type are required');
        return;
      }

      const payload = {
        title: eventTitle,
        location: eventLocation,
        date: eventDate ? new Date(eventDate).toISOString() : null,
        type: eventType,
        smsTemplate,
        mcs: validMcs,
        deskAttendees: validAttendees,
      };

      const response = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const { mcs: createdMcs, deskAttendees: createdAttendees } = await response.json();
        setLoading(true);
        // Refresh assignees and events
        const [assigneesResponse, eventsResponse] = await Promise.all([
          fetch('/api/roles/list'),
          fetch('/api/events'),
        ]);
        if (assigneesResponse.ok) setAssignees(await assigneesResponse.json());
        if (eventsResponse.ok) {
          const newEvents = await eventsResponse.json();
          setEvents(newEvents);
          setSelectedEventId(newEvents[newEvents.length - 1]?.id || selectedEventId);
        }
        setShowModal(false);
        setEventTitle('');
        setEventLocation('');
        setEventDate('');
        setEventType('');
        setSmsTemplate('');
        setMcs([]); // Reset to empty array
        setDeskAttendees([]); // Reset to empty array
        alert('Event created! Send credentials from the SMS section.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Error creating event');
    } finally {
      setLoading(false);
    }
  };


  // Send Custom SMS
  const sendCustomSMS = () => {
    if (!smsPhone || !smsMessage) {
      alert('Please enter a phone number and message');
      return;
    }
    const smsLink = `sms:${smsPhone}?body=${encodeURIComponent(smsMessage)}`;
    if (confirm('Open messaging app to send SMS?')) {
      window.location.href = smsLink;
      setSmsPhone('');
      setSmsMessage('');
    }
  };

  // Send Credentials to Assignee
  const sendCredentials = async (assignee: Assignee) => {
    const event = events.find((e) => e.id === assignee.event.id);
    const smsMessage = `You have been made ${assignee.role.replace('_', ' ').toLowerCase()} for ${event?.title} in GiftDesk. Login details: Username: ${assignee.username}, Password: ${assignee.password}`;
    const smsLink = `sms:${assignee.phone}?body=${encodeURIComponent(smsMessage)}`;
    if (confirm(`Send credentials to ${assignee.phone}?`)) {
      window.location.href = smsLink;
      // Update sentCredentials client-side
      setAssignees(
        assignees.map((a) =>
          a.id === assignee.id ? { ...a, sentCredentials: true } : a
        )
      );
      // Update server-side
      try {
        setLoading(true)
        await fetch('/api/roles/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: assignee.id, sentCredentials: true }),
        });
      } catch (error) {
        console.error('Error updating credentials status:', error);
         setError('Failed to update credentials status');
      }
      finally{
        setLoading(false);
      }
    }
  };

  // Send All Credentials
  const sendAllCredentials = async () => {
    const targetAssignees = assignees.filter(
      (a) => !selectedEventId || a.event.id === selectedEventId
    );
    if (targetAssignees.length === 0) {
      setError('No assignees for this event.');
      return;
    }
    if (confirm(`Send credentials to ${targetAssignees.length} assignees?`)) {
      for (const assignee of targetAssignees) {
        const event = events.find((e) => e.id === assignee.event.id);
        const smsMessage = `You have been made ${assignee.role.replace('_', ' ').toLowerCase()} for ${event?.title} in GiftDesk. Login details: Username: ${assignee.username}, Password: ${assignee.password}`;
        const smsLink = `sms:${assignee.phone}?body=${encodeURIComponent(smsMessage)}`;
        window.location.href = smsLink;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      // Update sentCredentials
      setAssignees(
        assignees.map((a) =>
          targetAssignees.some((u) => u.id === a.id)
            ? { ...a, sentCredentials: true }
            : a
        )
      );
      try {
        setLoading(true);
        await Promise.all(
          targetAssignees.map((a) =>
            fetch('/api/roles/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: a.id, sentCredentials: true }),
            })
          )
        );
      } catch (error) {
        console.error('Error updating credentials status:', error);
        setError('Failed to update credentials status');
      }
      setLoading(false);
    }
  };

  // Download Donations PDF
  const downloadDonationsPDF = async () => {
    if (!selectedEventId) {
      setError('Please select an event');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/donations/${selectedEventId}`);
      if (!response.ok) {
        setError('Failed to fetch donations');
        return;
      }

      const donations: Donation[] = await response.json();
      const event = events.find((e) => e.id === selectedEventId);

      // Calculate totals by currency
    const currencyTotals = donations.reduce((acc, d) => {
      if (d.amount != null && d.currency) {
        acc[d.currency] = (acc[d.currency] || 0) + d.amount;
      }
      return acc;
    }, {} as Record<string, number>);

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Donations for ${event?.title || 'Event'}`, 20, 20);

      // Prepare table data
      const tableData = donations.map((d) => [
        d.donorName,
        d.donorPhone || '',
      d.giftItem || '',
      d.amount != null ? `${d.currency || 'GHS'} ${d.amount.toFixed(2)}` : '',
      d.donatedTo || '', 
        d.notes || '',
        // d.status,
        new Date(d.createdAt).toLocaleString(),
      ]);

      // Generate donations table
      autoTable(doc, {
        startY: 30,
        head: [['Donor Name', 'Phone', 'Gift Item', 'Amount', 'DonatedTo', 'Notes', 'Created At']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
        margin : {bottom: 40},
      });

      // Add currency totals
    let finalY = (doc as any).lastAutoTable.finalY || 30; // Get Y position after table
    doc.setFontSize(12);
    doc.text('Total Donations by Currency:', 20, finalY + 10);

    let offsetY = finalY + 20;
    Object.entries(currencyTotals).forEach(([currency, total]) => {
      doc.text(`${currency}: ${total.toFixed(2)}`, 20, offsetY);
      offsetY += 10;
    });

    // Add note if no donations
    if (Object.keys(currencyTotals).length === 0) {
      doc.text('No monetary donations recorded.', 20, offsetY);
    }

      doc.save(`donations_${event?.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error generating PDF');
    }
    finally{
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return null;
  }

  // Handle click outside to close modal
  const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleOverlayClick = (event: MouseEvent | TouchEvent) => {
    const target = event.target as Node;
    if (modalRef.current && !modalRef.current.contains(target)) {
      setShowModal(false);
      setError('');
      setMcs([]);
      setDeskAttendees([]);
    }
  };

  document.addEventListener("mousedown", handleOverlayClick);
  document.addEventListener("touchstart", handleOverlayClick);

  return () => {
    document.removeEventListener("mousedown", handleOverlayClick);
    document.removeEventListener("touchstart", handleOverlayClick);
  };
}, []);


 return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-gray-900 dark:text-gray-100">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-center sm:text-left">
          Event Owner Dashboard
        </h1>
        {expiresAt && (
          <div className="text-sm sm:text-base bg-gray-100 dark:bg-gray-700 px-2 sm:px-3 py-1 rounded-full">
            Account expires in: {timeRemaining}
          </div>
        )}
      </div>
      {error && <p className="text-red-600 mb-4 text-sm sm:text-base text-center sm:text-left">{error}</p>}

      {/* Button Group */}
      <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 mb-6 sm:mb-8">
        <button
          onClick={() => setShowModal(true)}
          className="p-2 sm:p-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto"
          aria-label="Create Event"
        >
          Create Event
        </button>
        <button
          onClick={() => router.push('/dashboard/event-owner/events')}
          className="p-2 sm:p-3 bg-green-600 text-white text-sm sm:text-base rounded-lg hover:bg-green-700 transition-colors duration-200 w-full sm:w-auto"
          aria-label="View All Events"
        >
          All Events
        </button>
        {/* <button
          onClick={() => alert('Enter SMS details or send credentials below')}
          className="p-2 sm:p-3 bg-purple-600 text-white text-sm sm:text-base rounded-lg hover:bg-purple-700 transition-colors duration-200 w-full sm:w-auto"
          aria-label="Send SMS"
        >
          Send SMS
        </button> */}
        {selectedEventId && (
          <button
            onClick={downloadDonationsPDF}
            className="p-2 sm:p-3 bg-orange-600 text-white text-sm sm:text-base rounded-lg hover:bg-orange-700 transition-colors duration-200 w-full sm:w-auto"
            aria-label="Download Donations PDF"
          >
            Download Donations PDF
          </button>
        )}
      </div>

      {/* Send Custom SMS and Credentials */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 text-center sm:text-left">
          Send SMS
        </h2>
        {/* Custom SMS Form */}
        <div className="grid gap-4 sm:gap-5 mb-6">
          <input
            type="tel"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            placeholder="Recipient Phone (e.g., +233243248781)"
            className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
            aria-label="Recipient Phone Number"
          />
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="SMS Message"
            className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full min-h-[80px] sm:min-h-[100px]"
            aria-label="SMS Message"
          />
          <button
            onClick={sendCustomSMS}
            className="p-2 sm:p-3 bg-purple-600 text-white text-sm sm:text-base rounded-lg hover:bg-purple-700 transition-colors duration-200"
            aria-label="Send Custom SMS"
          >
            Send Custom SMS
          </button>
        </div>

        {/* Credentials Sending */}
        <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-4 text-center sm:text-left">
          Send Credentials
        </h3>
        <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(Number(e.target.value) || null)}
            className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-fit"
            aria-label="Select Event"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <button
            onClick={sendAllCredentials}
            className="p-2 sm:p-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto"
            aria-label="Send All Credentials"
          >
            Send All Credentials
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">ID</th> 
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Event</th>
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Username</th>
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Phone</th>
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Role</th>
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Status</th>
                <th className="p-2 sm:p-3 border dark:border-gray-600 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
             {assignees
                .filter((a) => !selectedEventId || a.event.id === selectedEventId)
                .map((assignee) => {
                  const event = events.find((e) => e.id === assignee.event.id);
                  return (
                    <tr
                      key={assignee.id}
                      className="border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <td className="p-2 sm:p-3 truncate max-w-[50px] sm:max-w-[70px] md:max-w-[100px]">
                        {event?.Id || 'N/A'} {/* Display local ID */}
                      </td>
                      <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {assignee.event.title}
                      </td>
                      <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {assignee.username}
                      </td>
                      <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {assignee.phone}
                      </td>
                      <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {assignee.role.replace('_', ' ')}
                      </td>
                      <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {assignee.sentCredentials ? 'Sent' : 'Pending'}
                      </td>
                      <td className="p-2 sm:p-3">
                        <button
                          onClick={() => sendCredentials(assignee)}
                          className="p-1 sm:p-2 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto"
                          aria-label={`Send credentials for ${assignee.username}`}
                        >
                          Send
                      </button>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
          // onClick={handleOverlayClick}
        >
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg w-full max-w-md sm:max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 text-center sm:text-left">
              Create Event
            </h2>
            {error && (
              <p className="text-red-600 mb-4 text-sm sm:text-base text-center sm:text-left">
                {error}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createEvent();
              }}
              className="grid gap-4 sm:gap-5"
            >
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event Title"
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                required
                aria-label="Event Title"
              />
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location"
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                aria-label="Event Location"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                aria-label="Event Date"
              />
              <input
                list="event-types"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="Enter or select event type"
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                required
                aria-label="Event Type"
              />
              <datalist id="event-types">
                <option value="Wedding" />
                <option value="Funeral" />
                <option value="Birthday" />
              </datalist>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Please ensure all dynamic placeholders ({'{donorName}'}, {'{amount}'}, {'{gift}'}, {'{target}'}) are included in your SMS template.
              </div>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                placeholder="SMS Template (e.g., ACKNOWLEDGEMENT. Dear {donorName} The Cofie family wishes to thank you for your generous donation of {amount} {gift} to {target}. God bless you!)"
                className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full min-h-[80px] sm:min-h-[100px]"
                aria-label="SMS Template"
              />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mt-4 sm:mt-6 text-center sm:text-left">
                MC Details
              </h3>
              {mcs.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base text-center sm:text-left">
                  No MCs added. Click below to add one.
                </p>
              )}
              {mcs.map((mc, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:gap-3 border p-3 sm:p-4 rounded-lg dark:border-gray-600"
                >
                  <input
                    type="text"
                    value={mc.username}
                    onChange={(e) => updateMc(index, 'username', e.target.value)}
                    placeholder="MC Username"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`MC ${index + 1} Username`}
                  />
                  <input
                    type="password"
                    value={mc.password}
                    onChange={(e) => updateMc(index, 'password', e.target.value)}
                    placeholder="MC Password"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`MC ${index + 1} Password`}
                  />
                  <input
                    type="tel"
                    value={mc.phone}
                    onChange={(e) => updateMc(index, 'phone', e.target.value)}
                    placeholder="MC Contact (e.g., +233243248781)"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`MC ${index + 1} Contact Number`}
                  />
                  <button
                    type="button"
                    onClick={() => removeMc(index)}
                    className="p-2 sm:p-3 bg-red-600 text-white text-sm sm:text-base rounded-lg hover:bg-red-700 transition-colors duration-200"
                    aria-label={`Remove MC ${index + 1}`}
                  >
                    Remove MC
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMc}
                className="p-2 sm:p-3 bg-gray-600 text-white text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors duration-200 mt-2 sm:mt-3"
                aria-label="Add MC"
              >
                Add MC
              </button>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mt-4 sm:mt-6 text-center sm:text-left">
                Desk Attendee Details
              </h3>
              {deskAttendees.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base text-center sm:text-left">
                  No Desk Attendees added. Click below to add one.
                </p>
              )}
              {deskAttendees.map((attendee, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:gap-3 border p-3 sm:p-4 rounded-lg dark:border-gray-600"
                >
                  <input
                    type="text"
                    value={attendee.username}
                    onChange={(e) => updateDeskAttendee(index, 'username', e.target.value)}
                    placeholder="Desk Attendee Username"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`Desk Attendee ${index + 1} Username`}
                  />
                  <input
                    type="password"
                    value={attendee.password}
                    onChange={(e) => updateDeskAttendee(index, 'password', e.target.value)}
                    placeholder="Desk Attendee Password"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`Desk Attendee ${index + 1} Password`}
                  />
                  <input
                    type="tel"
                    value={attendee.phone}
                    onChange={(e) => updateDeskAttendee(index, 'phone', e.target.value)}
                    placeholder="Desk Attendee Contact (e.g., +233243248781)"
                    className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 w-full"
                    aria-label={`Desk Attendee ${index + 1} Contact Number`}
                  />
                  <button
                    type="button"
                    onClick={() => removeDeskAttendee(index)}
                    className="p-2 sm:p-3 bg-red-600 text-white text-sm sm:text-base rounded-lg hover:bg-red-700 transition-colors duration-200"
                    aria-label={`Remove Desk Attendee ${index + 1}`}
                  >
                    Remove Desk Attendee
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDeskAttendee}
                className="p-2 sm:p-3 bg-gray-600 text-white text-sm sm:text-base rounded-lg hover:bg-gray-700 transition-colors duration-200 mt-2 sm:mt-3"
                aria-label="Add Desk Attendee"
              >
                Add Desk Attendee
              </button>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 sm:mt-6">
                <button
                  type="submit"
                  className="p-2 sm:p-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto"
                  aria-label="Create Event"
                >
                  Create Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setMcs([]);
                    setDeskAttendees([]);
                  }}
                  className="p-2 sm:p-3 bg-red-600 text-white text-sm sm:text-base rounded-lg hover:bg-red-700 transition-colors duration-200 w-full sm:w-auto"
                  aria-label="Cancel"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}