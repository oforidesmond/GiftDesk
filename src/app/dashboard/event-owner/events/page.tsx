// src/app/all-events/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useLoading } from '@/context/LoadingContext';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';

type Event = {
  id: number;
  title: string;
  location: string | null;
  date: string | null;
  type: string;
  createdAt: string;
  image: string | null;
};

type Assignee = { id?: number; username: string; password?: string; phone: string };

interface EditForm {
  title: string;
  location: string;
  date: string;
  type: string;
  mcs: Assignee[];
  deskAttendees: Assignee[];
  removedMcs?: number[];
  removedDeskAttendees?: number[];
  smsTemplate: string;
  image?: File | null;
}

export default function AllEvents() {
   const { data: session, status } = useSession();
  const router = useRouter();
  const { setLoading } = useLoading();
  const [events, setEvents] = useState<Event[]>([]);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    location: '',
    date: '',
    type: '',
    mcs: [{ username: '', password: '', phone: '' }],
    deskAttendees: [{ username: '', password: '', phone: '' }],
    removedMcs: [],
    removedDeskAttendees: [],
    smsTemplate: '',
    image: null,
  });
    const [changedFields, setChangedFields] = useState<Set<keyof EditForm>>(new Set());
    const [imagePreview, setImagePreview] = useState<string | null>(null); 

  // Redirect if not Event Owner
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'EVENT_OWNER') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch Events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        // Sort events by date (newest first)
     const sortedEvents = data.sort((a: Event, b: Event) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setEvents(sortedEvents);
      } else {
        alert('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Error fetching events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Assign Local IDs (oldest = 1, newest = highest)
  const eventsWithLocalIds = events
    .map((event, index) => ({
      ...event,
      localId: events.length - index, // Oldest gets 1, newest gets highest
    }))
    .reverse(); // Ensure newest at top

  // Delete Event
  const handleDelete = async (eventId: number, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`)) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setEvents(events.filter((event) => event.id !== eventId));
      } else {
      const errorData = await response.json();
      alert(`Failed to delete event: ${errorData.details || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event');
    } finally {
      setLoading(false);
    }
  };

  // Fetch MCs and Desk Attendees for Edit
  const fetchEventDetails = async (eventId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
       const data = await response.json();
      console.log('Fetched event details:', data); 
      return {
        mcs: data.mcs,
        deskAttendees: data.deskAttendees,
        smsTemplate: data.smsTemplate || '',
      };
    }
      return null;
    } catch (error) {
      console.error('Error fetching event details:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
 const handleEdit = async (event: Event) => {
  const details = await fetchEventDetails(event.id);
  console.log('Setting edit form with details:', details);
  setEditEvent(event);
  setEditForm({
    title: event.title,
    location: event.location || '',
    date: event.date ? new Date(event.date).toISOString().slice(0, 10) : '',
    type: event.type,
    mcs:
      details?.mcs?.map((mc: { id: number; username: string; phone: string }) => ({
        id: mc.id,
        username: mc.username,
        phone: mc.phone,
        password: '', // Password not returned from API for security
      })) || [{ username: '', password: '', phone: '' }],
    deskAttendees:
      details?.deskAttendees?.map((da: { id: number; username: string; phone: string }) => ({
        id: da.id,
        username: da.username,
        phone: da.phone,
        password: '',
      })) || [{ username: '', password: '', phone: '' }],
    removedMcs: [],
    removedDeskAttendees: [],
     smsTemplate: details?.smsTemplate || '',
     image: null,
  });
  setImagePreview(event.image || null);
  setChangedFields(new Set());
  setShowEditModal(true);
};

// Handle Image Change
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) {
    console.warn('No file selected');
    alert('No file selected. Please choose an image.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    console.warn('Invalid file type:', file.type);
    alert('Please select an image file (JPEG, PNG, etc.)');
    return;
  }
  try {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    console.log('Compressing image:', { name: file.name, size: file.size, type: file.type });
    const compressedFile = await imageCompression(file, options);
    setEditForm((prev) => ({ ...prev, image: compressedFile }));
    setChangedFields((prev) => new Set(prev).add('image'));
    // Create preview URL
    const previewUrl = URL.createObjectURL(compressedFile);
    setImagePreview(previewUrl);
    console.log('Image compressed successfully:', { name: compressedFile.name, size: compressedFile.size });
    return () => URL.revokeObjectURL(previewUrl); // Cleanup on unmount
  } catch (err) {
    console.error('Error compressing image:', err);
    alert('Failed to process image. Please try again.');
  }
};

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (imagePreview && !editEvent?.image) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, editEvent?.image]);

  // Update Event
  const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editEvent) return;

  try {
    setLoading(true);
    const formData = new FormData();

    // Include all fields, even if unchanged, to match backend expectations
    formData.append('title', editForm.title);
    formData.append('location', editForm.location || '');
    formData.append('date', editForm.date || '');
    formData.append('type', editForm.type);
    formData.append('smsTemplate', editForm.smsTemplate || '');

    // Filter out invalid assignees and only include password for new users
    const mcs = editForm.mcs
      .filter((mc) => mc.username && (!mc.id || mc.password)) // Include password only for new users or if provided
      .map((mc) => ({
        id: mc.id,
        username: mc.username,
        phone: mc.phone,
        ...(mc.password && !mc.id ? { password: mc.password } : {}), // Exclude password for existing users unless changed
      }));
    const deskAttendees = editForm.deskAttendees
      .filter((da) => da.username && (!da.id || da.password))
      .map((da) => ({
        id: da.id,
        username: da.username,
        phone: da.phone,
        ...(da.password && !da.id ? { password: da.password } : {}),
      }));

    // Append array fields as JSON strings
    formData.append('mcs', JSON.stringify(mcs));
    formData.append('deskAttendees', JSON.stringify(deskAttendees));
    if (editForm.removedMcs?.length) formData.append('removedMcs', JSON.stringify(editForm.removedMcs));
    if (editForm.removedDeskAttendees?.length)
      formData.append('removedDeskAttendees', JSON.stringify(editForm.removedDeskAttendees));

    // Handle image
    if (editForm.image) {
      console.log('Appending image to FormData:', { name: editForm.image.name, size: editForm.image.size });
      formData.append('image', editForm.image);
    } else if (imagePreview === null && editEvent.image) {
      console.log('Appending imageAction: remove');
      formData.append('imageAction', 'remove');
    }

    // Log FormData contents for debugging
    const formDataEntries = Object.fromEntries(formData.entries());
    console.log('Sending Update FormData:', {
      ...formDataEntries,
      image: editForm.image ? { name: editForm.image.name, size: editForm.image.size } : null,
      mcs: mcs,
      deskAttendees: deskAttendees,
      removedMcs: editForm.removedMcs,
      removedDeskAttendees: editForm.removedDeskAttendees,
    });

    const response = await fetch(`/api/events/${editEvent.id}`, {
      method: 'PUT',
      body: formData,
    });

    let responseData: { error?: string; details?: string; message?: string } = {};
    try {
      responseData = await response.json();
    } catch (err) {
      console.error('Failed to parse response JSON:', err);
      responseData = { error: 'Invalid server response', details: 'Server returned invalid JSON' };
    }

    if (response.ok) {
      await fetchEvents();
      setShowEditModal(false);
      setEditEvent(null);
      setEditForm({
        title: '',
        location: '',
        date: '',
        type: '',
        mcs: [{ username: '', password: '', phone: '' }],
        deskAttendees: [{ username: '', password: '', phone: '' }],
        removedMcs: [],
        removedDeskAttendees: [],
        smsTemplate: '',
        image: null,
      });
      setImagePreview(null);
      setChangedFields(new Set());
      alert('Event updated successfully');
    } else {
      console.error('Update failed:', responseData);
      alert(`Failed to update event: ${responseData.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error updating event:', error);
    alert('Error updating event');
  } finally {
    setLoading(false);
  }
};

  // Handle Form Input Changes
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    setChangedFields((prev) => new Set(prev).add(name as keyof EditForm));
  };

 // Handle MCs and Desk Attendees Changes
   const handleMcChange = (index: number, field: keyof Assignee, value: string) => {
    setEditForm((prev) => {
      const newMcs = [...prev.mcs];
      newMcs[index] = { ...newMcs[index], [field]: value };
      return { ...prev, mcs: newMcs };
    });
    setChangedFields((prev) => new Set(prev).add('mcs'));
  };

 const handleDeskAttendeeChange = (index: number, field: keyof Assignee, value: string) => {
    setEditForm((prev) => {
      const newDeskAttendees = [...prev.deskAttendees];
      newDeskAttendees[index] = { ...newDeskAttendees[index], [field]: value };
      return { ...prev, deskAttendees: newDeskAttendees };
    });
    setChangedFields((prev) => new Set(prev).add('deskAttendees'));
  };

const addMc = () => {
    setEditForm((prev) => {
      const newState = {
      ...prev,
      mcs: [...prev.mcs, { username: '', password: '', phone: '' }],
      };
      return newState;
    });
    setChangedFields((prev) => new Set(prev).add('mcs'));
  };

    const removeMc = (index: number) => {
      setEditForm((prev) => {
        const removedMc = prev.mcs[index];
        const newMcs = prev.mcs.filter((_, i) => i !== index);
        const newRemovedMcs = removedMc.id
          ? [...(prev.removedMcs || []), removedMc.id]
          : prev.removedMcs || [];
        return { ...prev, mcs: newMcs, removedMcs: newRemovedMcs };
      });
  setChangedFields((prev) => new Set(prev).add('mcs').add('removedMcs'));
    };

   const addDeskAttendee = () => {
   setEditForm((prev) => {
    const newState = {
      ...prev,
      deskAttendees: [...prev.deskAttendees, { username: '', password: '', phone: '' }],
    };
    console.log('New deskAttendees:', newState.deskAttendees);
    return newState;
  });
  setChangedFields((prev) => new Set(prev).add('deskAttendees'));
};

 const removeDeskAttendee = (index: number) => {
  setEditForm((prev) => {
    const removedDa = prev.deskAttendees[index];
    const newDeskAttendees = prev.deskAttendees.filter((_, i) => i !== index);
    const newRemovedDeskAttendees = removedDa.id
      ? [...(prev.removedDeskAttendees || []), removedDa.id]
      : prev.removedDeskAttendees || [];
    return { ...prev, deskAttendees: newDeskAttendees, removedDeskAttendees: newRemovedDeskAttendees };
  });
  setChangedFields((prev) => new Set(prev).add('deskAttendees').add('removedDeskAttendees'));
};

  // Close Modal
  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditEvent(null);
    setChangedFields(new Set<keyof EditForm>());
  };

  // Handle Backdrop Click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  if (status === 'loading') {
    return null;
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
              <th className="p-2 sm:p-3 border text-left font-medium">ID</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Title</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Location</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Date</th>
              <th className="p-2 sm:p-3 text-xs sm:text-sm md:text-base">Image</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Type</th>
              <th className="p-2 sm:p-3 border text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {eventsWithLocalIds.map((event) => (
              <tr key={event.id} className="border-b hover:bg-gray-50">
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.localId}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.title}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.location || 'N/A'}
                </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.date ? new Date(event.date).toLocaleString() : 'N/A'}
                </td>
                <td className="p-2 sm:p-3">
                {event.image && (
              <Image src={event.image} alt={event.title} width={50} height={50} className="rounded-md" />
            )}
            </td>
                <td className="p-2 sm:p-3 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                  {event.type}
                </td>
                <td className="p-2 sm:p-3 flex gap-2 sm:gap-3 items-center">
                  <button
                    onClick={() => handleEdit(event)}
                    className="p-1 sm:p-2 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label={`Edit event ${event.title}`}
                  >
                    <PencilSquareIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <button
                    onClick={() => handleDelete(event.id, event.title)}
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

{/* Edit Event Modal */}
{showEditModal && (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-40 overflow-y-auto"
    onClick={handleBackdropClick}
  >
    <div
      className="bg-white rounded-lg p-4 sm:p-6 md:p-8 w-full max-w-[90%] sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-2 sm:mx-4 my-4 max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 top-0 bg-white z-10">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
          Edit Event
        </h2>
        <button
          onClick={handleCloseModal}
          className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 p-1"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={handleUpdate} className="space-y-4 sm:space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm sm:text-base font-medium text-gray-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={editForm.title}
            onChange={handleInputChange}
            required
            className="mt-1 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm sm:text-base font-medium text-gray-700">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            value={editForm.location}
            onChange={handleInputChange}
            className="mt-1 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm sm:text-base font-medium text-gray-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={editForm.date}
            onChange={handleInputChange}
            className="mt-1 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Type */}
        <div>
          <label htmlFor="type" className="block text-sm sm:text-base font-medium text-gray-700">
            Type
          </label>
          <div className="relative">
            <input
              id="type"
              name="type"
              type="text"
              value={editForm.type}
              onChange={handleInputChange}
              required
              className="mt-1 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
              list="event-types"
            />
            <datalist id="event-types">
              <option value="WEDDING" />
              <option value="FUNERAL" />
              <option value="BIRTHDAY" />
            </datalist>
          </div>
        </div>

        {/* Image */}
              <div className="mb-4">
                <label htmlFor="image" className="block text-sm sm:text-base font-medium text-gray-700">
                  Event Image
                </label>
                {imagePreview && (
                  <div className="mt-2">
                    <Image
                      src={imagePreview}
                      alt="Event Image Preview"
                      width={150}
                      height={150}
                      className="rounded-md"
                    />
                  </div>
                )}
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm((prev) => ({ ...prev, image: null }));
                      setImagePreview(null);
                      setChangedFields((prev) => new Set(prev).add('image'));
                    }}
                    className="mt-2 px-2 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600"
                  >
                    Remove Image
                  </button>
                )}
                <input
                  id="image"
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-1 p-2 w-full border rounded-md text-sm text-black"
                />
              </div>

        {/* SMS Template */}
        <div>
        <label htmlFor="smsTemplate" className="block text-sm sm:text-base font-medium text-gray-700">
        SMS Template
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Please ensure all dynamic placeholders ({'{donorName}'}, {'{amount}'}, {'{gift}'}, {'{target}'}) are included in your SMS template.
        </div>
        </label>
        <textarea
        id="smsTemplate"
        name="smsTemplate"
        value={editForm.smsTemplate}
        onChange={handleInputChange}
        className="mt-1 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
        rows={4}
        placeholder="Enter SMS template"
        />
        </div>
        {/* MCs */}
        <div>
          <label className="block text-sm sm:text-base font-medium text-gray-700">MCs</label>
          <div className="space-y-3 sm:space-y-4">
            {editForm.mcs.map((mc, index) => (
              <div key={index} className="p-3 sm:p-4 border rounded-md bg-gray-50">
                <input
                  type="text"
                  placeholder="Username"
                  value={mc.username}
                  onChange={(e) => handleMcChange(index, 'username', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={mc.password}
                  onChange={(e) => handleMcChange(index, 'password', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={mc.phone}
                  onChange={(e) => handleMcChange(index, 'phone', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeMc(index)}
                  className="text-red-600 hover:text-red-800 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Remove MC
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addMc}
              className="text-blue-600 hover:text-blue-800 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add MC
            </button>
          </div>
        </div>
        {/* Desk Attendees */}
        <div>
          <label className="block text-sm sm:text-base font-medium text-gray-700">
            Desk Attendees
          </label>
          <div className="space-y-3 sm:space-y-4">
            {editForm.deskAttendees.map((da, index) => (
              <div key={index} className="p-3 sm:p-4 border rounded-md bg-gray-50">
                <input
                  type="text"
                  placeholder="Username"
                  value={da.username}
                  onChange={(e) => handleDeskAttendeeChange(index, 'username', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={da.password}
                  onChange={(e) => handleDeskAttendeeChange(index, 'password', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={da.phone}
                  onChange={(e) => handleDeskAttendeeChange(index, 'phone', e.target.value)}
                  className="mb-2 p-2 sm:p-3 w-full border rounded-md text-sm sm:text-base text-black focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeDeskAttendee(index)}
                  className="text-red-600 hover:text-red-800 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Remove Desk Attendee
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addDeskAttendee}
              className="text-blue-600 hover:text-blue-800 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Desk Attendee
            </button>
          </div>
        </div>
        {/* Form Actions */}
        <div className="flex justify-end space-x-2 sm:space-x-3 bottom-0 bg-white pt-4">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 sm:px-4 py-2 text-sm sm:text-base text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  </div>
      )}
    </div>
  );
}