import crypto from 'node:crypto';
import type { AppUser, Invitation } from './auth-types';
import { pool } from './pool';

export async function getUsers(): Promise<AppUser[]> {
  const result = await pool.query(
    `SELECT id, email, name, image, role, invited_by, invited_at, created_at, last_login, last_accessed, api_key, person_id FROM users ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function getUser(id: string): Promise<AppUser | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function updateUserRole(id: string, role: string): Promise<void> {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
}

export async function linkUserToPerson(
  userId: string,
  personId: string | null,
): Promise<void> {
  await pool.query('UPDATE users SET person_id = $1 WHERE id = $2', [
    personId,
    userId,
  ]);
}

export async function deleteUser(id: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

export async function getInvitations(): Promise<Invitation[]> {
  const result = await pool.query(
    'SELECT * FROM invitations ORDER BY created_at DESC',
  );
  return result.rows;
}

export async function createInvitation(
  email: string,
  role: string,
  invitedBy: string,
): Promise<Invitation> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const result = await pool.query(
    `INSERT INTO invitations (email, role, invited_by, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email, role, invitedBy, token, expiresAt],
  );
  return result.rows[0];
}

export async function deleteInvitation(id: string): Promise<void> {
  await pool.query('DELETE FROM invitations WHERE id = $1', [id]);
}

export async function logAudit(
  userId: string,
  action: string,
  details: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (user_id, action, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, action, details, ipAddress || null],
  );
}

export async function getAuditLog(limit: number = 100) {
  const result = await pool.query(
    `SELECT al.*, u.email, u.name 
     FROM audit_log al 
     LEFT JOIN users u ON al.user_id = u.id 
     ORDER BY al.created_at DESC 
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}
