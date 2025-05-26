'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
};

type Donation = {
  id: number;
  donorName: string;
  donorPhone: string | null;
  giftItem: string | null;
  amount: number;
  notes: string | null;
  status: string;
  createdAt: string;
};

export default function EventOwnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
  const [events, setEvents] = useState<Event[]>([]);
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
        // Fetch events
        const eventsResponse = await fetch('/api/events');
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData);
          if (eventsData.length > 0 && !selectedEventId) {
            setSelectedEventId(eventsData[0].id);
          }
        }

        // Fetch assignees
        const assigneesResponse = await fetch('/api/roles/list');
        if (assigneesResponse.ok) {
          const assigneesData = await assigneesResponse.json();
          setAssignees(assigneesData);
        }

        // Fetch user expiresAt
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setExpiresAt(userData.expiresAt);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
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
        await fetch('/api/roles/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: assignee.id, sentCredentials: true }),
        });
      } catch (error) {
        console.error('Error updating credentials status:', error);
         setError('Failed to update credentials status');
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
    }
  };

  // Download Donations PDF
  const downloadDonationsPDF = async () => {
    if (!selectedEventId) {
      setError('Please select an event');
      return;
    }

    try {
      const response = await fetch(`/api/donations/${selectedEventId}`);
      if (!response.ok) {
        setError('Failed to fetch donations');
        return;
      }

      const donations: Donation[] = await response.json();
      const event = events.find((e) => e.id === selectedEventId);

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Donations for ${event?.title || 'Event'}`, 20, 20);

      const tableData = donations.map((d) => [
        d.donorName,
        d.donorPhone || 'N/A',
        d.giftItem || 'N/A',
        `GH₵${d.amount.toFixed(2)}`,
        d.notes || 'N/A',
        d.status,
        new Date(d.createdAt).toLocaleString(),
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['Donor Name', 'Phone', 'Gift Item', 'Amount', 'Notes', 'Status', 'Created At']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
      });

      doc.save(`donations_${event?.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error generating PDF');
    }
  };

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

 return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Owner Dashboard</h1>
        {expiresAt && (
          <div className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
            Account expires in: {timeRemaining}
          </div>
        )}
      </div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setShowModal(true)}
          className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Event
        </button>
        <button
          onClick={() => router.push('/dashboard/event-owner/events')}
          className="p-3 bg-green-600 text-white rounded hover:bg-green-700"
        >
          All Events
        </button>
        <button
          onClick={() => alert('Enter SMS details or send credentials below')}
          className="p-3 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Send SMS
        </button>
        {selectedEventId && (
          <button
            onClick={downloadDonationsPDF}
            className="p-3 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Download Donations PDF
          </button>
        )}
      </div>

      {/* Send Custom SMS and Credentials */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Send SMS</h2>
        {/* Custom SMS Form */}
        <div className="grid gap-4 mb-6">
          <input
            type="tel"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            placeholder="Recipient Phone (e.g., +233243248781)"
            className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="SMS Message"
            className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={sendCustomSMS}
            className="p-3 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Send Custom SMS
          </button>
        </div>

        {/* Credentials Sending */}
        <h3 className="text-lg font-semibold mb-4">Send Credentials</h3>
        <div className="mb-4 flex gap-4">
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(Number(e.target.value) || null)}
            className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
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
            className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send All Credentials
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700">
              <th className="p-3 border dark:border-gray-600">Event</th>
              <th className="p-3 border dark:border-gray-600">Username</th>
              <th className="p-3 border dark:border-gray-600">Phone</th>
              <th className="p-3 border dark:border-gray-600">Role</th>
              <th className="p-3 border dark:border-gray-600">Status</th>
              <th className="p-3 border dark:border-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {assignees
              .filter((a) => !selectedEventId || a.event.id === selectedEventId)
              .map((assignee) => (
                <tr key={assignee.id} className="border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <td className="p-3">{assignee.event.title}</td>
                  <td className="p-3">{assignee.username}</td>
                  <td className="p-3">{assignee.phone}</td>
                  <td className="p-3">{assignee.role.replace('_', ' ')}</td>
                  <td className="p-3">{assignee.sentCredentials ? 'Sent' : 'Pending'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => sendCredentials(assignee)}
                      className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Send
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Event</h2>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <form onSubmit={(e) => { e.preventDefault(); createEvent(); }} className="grid gap-4">
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event Title"
                className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                required
              />
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location"
                className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                required
              >
                <option value="">Select Event Type</option>
                <option value="Wedding">Wedding</option>
                <option value="Funeral">Funeral</option>
                <option value="Birthday">Birthday</option>
              </select>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                placeholder="SMS Template (e.g., Thank you, {donorName}, for your generous gift to {eventName}. May you be richly blessed!)"
                className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <h3 className="text-lg font-semibold mt-4">MC Details</h3>
              {mcs.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400">No MCs added. Click below to add one.</p>
              )}
              {mcs.map((mc, index) => (
                <div key={index} className="grid gap-2 border p-4 rounded dark:border-gray-600">
                  <input
                    type="text"
                    value={mc.username}
                    onChange={(e) => updateMc(index, 'username', e.target.value)}
                    placeholder="MC Username"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="password"
                    value={mc.password}
                    onChange={(e) => updateMc(index, 'password', e.target.value)}
                    placeholder="MC Password"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="tel"
                    value={mc.phone}
                    onChange={(e) => updateMc(index, 'phone', e.target.value)}
                    placeholder="MC Contact Number (e.g., +233243248781)"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeMc(index)}
                    className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove MC
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMc}
                className="p-3 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Add MC
              </button>
              <h3 className="text-lg font-semibold mt-4">Desk Attendee Details</h3>
              {deskAttendees.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400">No Desk Attendees added. Click below to add one.</p>
              )}
              {deskAttendees.map((attendee, index) => (
                <div key={index} className="grid gap-2 border p-4 rounded dark:border-gray-600">
                  <input
                    type="text"
                    value={attendee.username}
                    onChange={(e) => updateDeskAttendee(index, 'username', e.target.value)}
                    placeholder="Desk Attendee Username"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="password"
                    value={attendee.password}
                    onChange={(e) => updateDeskAttendee(index, 'password', e.target.value)}
                    placeholder="Desk Attendee Password"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="tel"
                    value={attendee.phone}
                    onChange={(e) => updateDeskAttendee(index, 'phone', e.target.value)}
                    placeholder="Desk Attendee Contact Number (e.g., +233243248781)"
                    className="p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeDeskAttendee(index)}
                    className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove Desk Attendee
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDeskAttendee}
                className="p-3 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Add Desk Attendee
              </button>
              <div className="flex gap-4 mt-4">
                <button
                  type="submit"
                  className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
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
                  className="p-3 bg-red-600 text-white rounded hover:bg-red-700"
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