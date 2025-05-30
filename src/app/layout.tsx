import type { Metadata } from 'next';
import './globals.css';
import { NextAuthSessionProvider } from './providers';
// import Header from '@/components/Header';
import ConditionalHeader from '@/components/ConditionalHeader';
import PWAInstallModal from '@/components/PWAInstallModal';
import { LoadingProvider } from '@/context/LoadingContext';
import Loading from '@/components/Loading';

export const metadata: Metadata = {
  title: 'Gifts Desk App',
  description: 'Manage event donations',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#263238" />
      </head>
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
        <LoadingProvider>
        <NextAuthSessionProvider>
          <ConditionalHeader />
          <main className="container mx-auto p-4">{children}</main>
          <Loading/>
          <PWAInstallModal />
        </NextAuthSessionProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}