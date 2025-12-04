import NextAuth from 'next-auth';
import authConfig from './auth.config';

// Create a lightweight auth instance for proxy (no database)
const { auth } = NextAuth(authConfig);

// Wrap auth for route protection
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Redirect to login if not authenticated (except login page)
  if (!isLoggedIn && pathname !== '/login') {
    return Response.redirect(new URL('/login', req.url));
  }

  // Redirect to home if already logged in and on login page
  if (isLoggedIn && pathname === '/login') {
    return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: [
    // Match all paths except static files, images, health check, and auth API
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/auth).*)',
  ],
};

