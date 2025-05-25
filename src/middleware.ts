import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const { role } = req.nextauth.token || {};

     // Allow access to no-event page for MCs and Desk Attendees
     if (['/dashboard/no-event', '/dashboard/select-event'].includes(pathname) && role && ['MC', 'DESK_ATTENDEE'].includes(role)) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/dashboard/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/dashboard/event-owner') && role !== 'EVENT_OWNER') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/dashboard/mc') && role !== 'MC') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    if (pathname.startsWith('/dashboard/desk-attendee') && role !== 'DESK_ATTENDEE') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*'],
};