'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NoEvent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && !['MC', 'DESK_ATTENDEE'].includes(session?.user?.role || '')) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return <div className="text-center mt-10">Loading...</div>;
  }

   return (
    <div
      className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-gray-100 rounded-lg shadow-md text-center text-black"
      role="alert"
      aria-live="polite"
    >
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6">
        No Assigned Events
      </h1>
      <p className="text-sm sm:text-base md:text-lg leading-relaxed">
        You are not assigned to any events. Please contact your Event Host for assistance.
      </p>
    </div>
  );
}