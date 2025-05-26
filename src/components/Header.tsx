// src/components/Header.tsx
'use client';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/sign-in');
  };

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        {/* Left Side: Logo and Text */}
        <div className="flex items-center space-x-2">
          <img src="/icon-192x192.png" alt="Logo" className="h-8 w-8 object-contain" />
          <span className="text-xl font-bold text-gray-900">Gift Desk</span>
        </div>

        {/* Right Side: Profile and Logout */}
        {status === 'authenticated' && session?.user?.name ? (
          <div className="relative">
            <button
              onClick={() => setShowLogout(!showLogout)}
              className="flex items-center space-x-2 focus:outline-none"
            >
              <UserCircleIcon className="h-8 w-8 text-gray-600" />
              <span className="text-gray-700">{session.user.name}</span>
            </button>
            {showLogout && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}