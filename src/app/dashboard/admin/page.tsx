'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type User = {
  id: number;
  username: string;
  phone: string | null;
  role: string;
  expiresAt: string | null;
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch all Event Owners
  useEffect(() => {
    const fetchUsers = async () => {
      const response = await fetch('/api/users/list');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    };
    fetchUsers();
  }, []);

  // Handle create Event Owner
  const createOwner = async () => {
    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        password,
        phone,
        role: 'EVENT_OWNER',
        expiresInDays: expiresAt ? parseInt(expiresAt, 10) : null,
      }),
    });
    if (response.ok) {
      const { username, password: createdPassword } = await response.json();
      // Trigger SMS with credentials
      const smsMessage = `Your Gifts Desk credentials: Username: ${username}, Password: ${createdPassword}`;
      const smsLink = `sms:${phone}?body=${encodeURIComponent(smsMessage)}`;
      window.location.href = smsLink;
      // Refresh user list
      const updatedUsers = await (await fetch('/api/users/list')).json();
      setUsers(updatedUsers);
      setUsername('');
      setPassword('');
      setPhone('');
      setExpiresAt('');
    } else {
      alert('Failed to create Event Owner');
    }
  };

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 md:py-8 bg-gray-100 rounded-lg shadow-md text-black">
      {/* Create Event Owner Form */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl md:text-2xl underline underline-offset-2 decoration-gray-900 font-semibold mb-4 text-center">
          Create New Event Host
        </h2>
        <div className="grid gap-4 sm:gap-5">
          <div className="flex flex-col">
            <label className="mb-1 text-sm sm:text-base font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 w-full"
              required
              aria-label="Username"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm sm:text-base font-medium text-gray-700">
              Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 w-full"
              required
              aria-label="Password"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm sm:text-base font-medium text-gray-700">
              Contact Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +233243248781"
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 w-full"
              aria-label="Contact Number"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm sm:text-base font-medium text-gray-700">
              Expiration Period (days)
            </label>
            <input
              type="number"
              min={1}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="p-2 sm:p-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 w-full"
              aria-label="Expiration Period"
            />
          </div>

          <button
            onClick={createOwner}
            className="p-2 sm:p-3 bg-gray-900 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-gray-800 transition-colors duration-200"
          >
            Create & Send SMS
          </button>
        </div>
      </div>

      {/* View All Event Hosts */}
      <div>
        <h2 className="text-lg underline underline-offset-2 decoration-gray-900 sm:text-xl md:text-2xl font-semibold mb-4 text-center sm:text-left">
          Event Hosts
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 sm:p-3 border text-left font-medium">Username</th>
                <th className="p-2 sm:p-3 border text-left font-medium">Contact</th>
                <th className="p-2 sm:p-3 border text-left font-medium">Expiration</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 sm:p-3 truncate max-w-[120px] sm:max-w-[200px]">
                    {user.username}
                  </td>
                  <td className="p-2 sm:p-3 truncate max-w-[120px] sm:max-w-[200px]">
                    {user.phone || 'N/A'}
                  </td>
                  <td className="p-2 sm:p-3 truncate max-w-[120px] sm:max-w-[200px]">
                    {user.expiresAt ? new Date(user.expiresAt).toLocaleString() : 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}