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
    <header className="bg-gray-900 shadow-md">
      <div className="mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-3 sm:py-4 flex justify-between items-center max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-7xl">
        {/* Left Side: Logo and Text */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img
            src="/icon-192x192.png"
            alt="GiftDesk Logo"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 object-contain"
          />
          <span className="text-sm sm:text-base md:text-lg font-light text-white tracking-tight">
            GiftDesk
          </span>
        </div>

        {/* Right Side: Profile and Logout */}
        {status === 'authenticated' && session?.user?.name ? (
          <div className="relative">
            <button
              onClick={() => setShowLogout(!showLogout)}
              className="flex items-center space-x-1 sm:space-x-2 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-md p-1 sm:p-2"
              aria-label="User menu"
              aria-expanded={showLogout}
              aria-haspopup="true"
            >
              <span className="text-sm sm:text-base md:text-lg font-light text-white truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                {session.user.name}
              </span>
              <UserCircleIcon className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
            </button>
            {showLogout && (
              <div className="absolute right-0 mt-2 w-32 sm:w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base text-gray-700 font-normal hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label="Logout"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-6 sm:w-8" /> // Spacer for consistent layout
        )}
      </div>
    </header>
  );
}