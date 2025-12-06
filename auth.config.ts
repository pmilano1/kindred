import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';

// Edge-compatible auth config (NO database calls in providers)
// Used by proxy.ts for authentication checks
// Actual credential validation happens in lib/auth.ts callbacks
const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      // authorize function is defined in lib/auth.ts where we have DB access
      async authorize() {
        // This is a placeholder - actual auth logic is in the signIn callback
        // The Credentials provider requires an authorize function but we handle
        // the actual validation in the full auth.ts config
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export default authConfig;

