import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { pool } from './pool';

// Full auth config with database callbacks
// Only used server-side (not in proxy/middleware)
export const { handlers, signIn, signOut, auth } = NextAuth({
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
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user with password
        const result = await pool.query(
          'SELECT id, email, name, image, role, password_hash FROM users WHERE email = $1 AND auth_provider = $2',
          [email, 'local']
        );

        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0];

        // Verify password
        if (!user.password_hash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          // Increment failed attempts
          await pool.query(
            'UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = $1',
            [user.id]
          );
          return null;
        }

        // Reset failed attempts and update last login
        await pool.query(
          'UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = $1',
          [user.id]
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // For credentials provider, the authorize function handles everything
      if (account?.provider === 'credentials') {
        return true;
      }

      // OAuth flow (Google)
      // Check if user exists or has an invitation
      const existingUser = await pool.query(
        'SELECT id, role FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length > 0) {
        // Update last login
        await pool.query(
          'UPDATE users SET last_login = NOW(), name = $1, image = $2 WHERE email = $3',
          [user.name, user.image, user.email]
        );
        return true;
      }

      // Check for pending invitation
      const invitation = await pool.query(
        `SELECT id, role FROM invitations
         WHERE email = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
        [user.email]
      );

      if (invitation.rows.length > 0) {
        // Accept invitation and create user
        const inv = invitation.rows[0];
        await pool.query(
          `INSERT INTO users (email, name, image, role, auth_provider, invited_at, last_login)
           VALUES ($1, $2, $3, $4, 'google', NOW(), NOW())`,
          [user.email, user.name, user.image, inv.role]
        );
        await pool.query(
          'UPDATE invitations SET accepted_at = NOW() WHERE id = $1',
          [inv.id]
        );
        return true;
      }

      // No user and no invitation - deny access
      return false;
    },
    async session({ session }) {
      if (session.user?.email) {
        const userResult = await pool.query(
          'SELECT id, role FROM users WHERE email = $1',
          [session.user.email]
        );
        if (userResult.rows.length > 0) {
          session.user.id = userResult.rows[0].id;
          session.user.role = userResult.rows[0].role;

          // Update last_accessed (throttled to once per minute to reduce DB writes)
          pool.query(
            `UPDATE users SET last_accessed = NOW()
             WHERE id = $1 AND (last_accessed IS NULL OR last_accessed < NOW() - INTERVAL '1 minute')`,
            [userResult.rows[0].id]
          ).catch(() => {}); // Fire and forget, don't block session
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const userResult = await pool.query(
          'SELECT id, role FROM users WHERE email = $1',
          [user.email]
        );
        if (userResult.rows.length > 0) {
          token.userId = userResult.rows[0].id;
          token.role = userResult.rows[0].role;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});

// Helper to check if user can perform action
export function canEdit(role: string | undefined): boolean {
  return role === 'admin' || role === 'editor';
}

export function isAdmin(role: string | undefined): boolean {
  return role === 'admin';
}

