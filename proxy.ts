import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth');

  // Allow auth API routes (health check is excluded via matcher)
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Redirect to home if already logged in and on login page
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files, images, and health check
    // Health check is excluded so it bypasses auth entirely
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.png$|.*\\.svg$).*)',
  ],
};

