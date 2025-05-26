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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md text-black">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Create Event Owner Form */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Create Event Owner</h2>
        <div className="grid gap-4">
          <input
            type="name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="p-2 border rounded"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="p-2 border rounded"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Contact Number (e.g., 0243248781)"
            className="p-2 border rounded"
          />
          <input
              type="number"
              min={1}
              placeholder="Credential Duration (days)"
              className="p-2 border rounded"
              onChange={(e) => setExpiresAt(e.target.value)}
          />
          <button
            onClick={createOwner}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Event Owner & Send SMS
          </button>
        </div>
      </div>

      {/* View All Event Owners */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Event Owners</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Username</th>
              <th className="p-2 border">Contact Number</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Expiration</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="p-2">{user.username}</td>
                <td className="p-2">{user.phone || 'N/A'}</td>
                <td className="p-2">{user.role}</td>
                <td className="p-2">
                  {user.expiresAt ? new Date(user.expiresAt).toLocaleString() : 'None'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}