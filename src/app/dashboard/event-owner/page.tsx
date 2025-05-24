'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

  // Redirect if not Event Owner
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'EVENT_OWNER') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch Events and Assignees
  useEffect(() => {
    const fetchData = async () => {
      const eventsResponse = await fetch('/api/events');
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
        if (eventsData.length > 0 && !selectedEventId) {
          setSelectedEventId(eventsData[0].id);
        }
      }

      const assigneesResponse = await fetch('/api/roles/list');
      if (assigneesResponse.ok) {
        const assigneesData = await assigneesResponse.json();
        setAssignees(assigneesData);
      }
    };
    fetchData();
  }, []);

  // Add MC
  const addMc = () => {
    setMcs([...mcs, { username: '', password: '', phone: '' }]);
  };

  // Add Desk Attendee
  const addDeskAttendee = () => {
    setDeskAttendees([...deskAttendees, { username: '', password: '', phone: '' }]);
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
    const response = await fetch('/api/events/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: eventTitle,
        location: eventLocation,
        date: eventDate ? new Date(eventDate).toISOString() : null,
        type: eventType,
        smsTemplate,
        mcs,
        deskAttendees,
      }),
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
      setMcs([{ username: '', password: '', phone: '' }]);
      setDeskAttendees([{ username: '', password: '', phone: '' }]);
      alert('Event created! Send credentials from the SMS section.');
    } else {
      alert('Failed to create event');
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
      await fetch('/api/roles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: assignee.id, sentCredentials: true }),
      });
    }
  };

  // Send All Credentials
  const sendAllCredentials = async () => {
    const targetAssignees = assignees.filter(
      (a) => !selectedEventId || a.event.id === selectedEventId
    );
    if (targetAssignees.length === 0) {
      alert('No assignees for this event.');
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
      await Promise.all(
        targetAssignees.map((a) =>
          fetch('/api/roles/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: a.id, sentCredentials: true }),
          })
        )
      );
    }
  };

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

 return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Event Owner Dashboard</h1>
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setShowModal(true)}
          className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Event
        </button>
        <button
          onClick={() => router.push('/dashboard/event-owner/events')}
          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          All Events
        </button>
        <button
          onClick={() => alert('Enter SMS details or send credentials below')}
          className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Send SMS
        </button>
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
            className="p-2 border rounded"
          />
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="SMS Message"
            className="p-2 border rounded"
          />
          <button
            onClick={sendCustomSMS}
            className="p-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Send Custom SMS
          </button>
        </div>

        {/* Credentials Sending */}
        <h3 className="text-lg font-semibold mb-4">Send Credentials</h3>
        <div className="mb-4">
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(Number(e.target.value) || null)}
            className="p-2 border rounded"
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
            className="ml-4 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send All Credentials
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Event</th>
              <th className="p-2 border">Username</th>
              <th className="p-2 border">Phone</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {assignees
              .filter((a) => !selectedEventId || a.event.id === selectedEventId)
              .map((assignee) => (
                <tr key={assignee.id} className="border-b">
                  <td className="p-2">{assignee.event.title}</td>
                  <td className="p-2">{assignee.username}</td>
                  <td className="p-2">{assignee.phone}</td>
                  <td className="p-2">{assignee.role.replace('_', ' ')}</td>
                  <td className="p-2">{assignee.sentCredentials ? 'Sent' : 'Pending'}</td>
                  <td className="p-2">
                    <button
                      onClick={() => sendCredentials(assignee)}
                      className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
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
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Event</h2>
            <div className="grid gap-4">
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event Title"
                className="p-2 border rounded"
              />
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location"
                className="p-2 border rounded"
              />
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="p-2 border rounded"
              />
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="p-2 border rounded"
              >
                <option value="">Select Event Type</option>
                <option value="Wedding">Wedding</option>
                <option value="Funeral">Funeral</option>
                <option value="Birthday">Birthday</option>
              </select>
              <textarea
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                placeholder="SMS Template (e.g., Thank you, {donorName}, for your generous gift to {eventName}. May you be richly blessed!)'"
                className="p-2 border rounded"
              />
              <h3 className="text-lg font-semibold mt-4">MC Details</h3>
              {mcs.map((mc, index) => (
                <div key={index} className="grid gap-2 border p-4 rounded">
                  <input
                    type="email"
                    value={mc.username}
                    onChange={(e) => updateMc(index, 'username', e.target.value)}
                    placeholder="MC Username"
                    className="p-2 border rounded"
                  />
                  <input
                    type="password"
                    value={mc.password}
                    onChange={(e) => updateMc(index, 'password', e.target.value)}
                    placeholder="MC Password"
                    className="p-2 border rounded"
                  />
                  <input
                    type="tel"
                    value={mc.phone}
                    onChange={(e) => updateMc(index, 'phone', e.target.value)}
                    placeholder="MC Contact Number"
                    className="p-2 border rounded"
                  />
                </div>
              ))}
              <button
                onClick={addMc}
                className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Add Another MC
              </button>
              <h3 className="text-lg font-semibold mt-4">Desk Attendee Details</h3>
              {deskAttendees.map((attendee, index) => (
                <div key={index} className="grid gap-2 border p-4 rounded">
                  <input
                    type="email"
                    value={attendee.username}
                    onChange={(e) => updateDeskAttendee(index, 'username', e.target.value)}
                    placeholder="Desk Attendee Username"
                    className="p-2 border rounded"
                  />
                  <input
                    type="password"
                    value={attendee.password}
                    onChange={(e) => updateDeskAttendee(index, 'password', e.target.value)}
                    placeholder="Desk Attendee Password"
                    className="p-2 border rounded"
                  />
                  <input
                    type="tel"
                    value={attendee.phone}
                    onChange={(e) => updateDeskAttendee(index, 'phone', e.target.value)}
                    placeholder="Desk Attendee Contact Number"
                    className="p-2 border rounded"
                  />
                </div>
              ))}
              <button
                onClick={addDeskAttendee}
                className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Add Another Desk Attendee
              </button>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={createEvent}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Event
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}