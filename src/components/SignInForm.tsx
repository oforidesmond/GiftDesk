'use client';
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Loading from './Loading';

export default function SignInForm() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [showPassword, setShowPassword] = useState(false);

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        setError('Invalid username or password');
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred during sign-in');
    }
  };

  if (status === 'loading') {
    return <Loading />;
  }

 return (
  <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gray-900">
    {/* Icon and App Name */}
    <div className="mb-6 text-center">
      <img
        src="/icon-192x192.png"
        alt="App Icon"
        className="w-20 h-20 mx-auto mb-2"
      />
      <h2 className="text-2xl font-semibold text-white">GiftDesk</h2>
    </div>

    <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-lg bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">Sign In</h1>

      <h3 className="text-sm sm:text-xs font-normal mb-6 text-center text-gray-600">Please login to proceed to your dashboard</h3>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="p-3 text-sm text-gray-700 sm:p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          required
        />
         <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="p-3 text-sm text-gray-700 sm:p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 w-full pr-10"
            required
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
          </button>
        </div>
        <button
          type="submit"
          className="p-3 sm:p-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors duration-200"
        >
          Sign In
        </button>
      </form>

       {error && <p className="text-red-600 m-2 mt-5 text-center text-sm font-light sm:text-base">{error}</p>}
    </div>
  </div>
);
}