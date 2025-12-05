import NextAuth from 'next-auth';
import { pool } from './db';
import authConfig from '../auth.config';

// Full auth config with database callbacks
// Only used server-side (not in proxy/middleware)
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

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
          `INSERT INTO users (email, name, image, role, invited_at, last_login)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
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
    async session({ session, token }) {
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

