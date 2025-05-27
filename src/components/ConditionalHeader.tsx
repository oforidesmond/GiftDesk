'use client';
import { usePathname } from 'next/navigation';
import Header from './Header';

export default function ConditionalHeader() {
  const pathname = usePathname();

  return !['/sign-in', '/reset-password'].includes(pathname) ? <Header /> : null;
}