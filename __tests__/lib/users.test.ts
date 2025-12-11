/**
 * User Management Tests
 * Tests for user CRUD operations and audit logging
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// vi.hoisted ensures mocks are available before vi.mock hoisting
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

// Mock the database pool
vi.mock('@/lib/pool', () => ({
  pool: {
    query: mockQuery,
  },
}));

import {
  createInvitation,
  deleteInvitation,
  deleteUser,
  getAuditLog,
  getInvitations,
  getUser,
  getUsers,
  linkUserToPerson,
  logAudit,
  updateUserRole,
} from '@/lib/users';

const mockedQuery = mockQuery as Mock;

describe('User Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('returns all users ordered by created_at', async () => {
      const mockUsers = [
        { id: 'u1', email: 'user1@test.com', name: 'User 1', role: 'admin' },
        { id: 'u2', email: 'user2@test.com', name: 'User 2', role: 'viewer' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockUsers });

      const result = await getUsers();

      expect(result).toEqual(mockUsers);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
      );
    });

    it('returns empty array when no users', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('returns user by id', async () => {
      const mockUser = { id: 'u1', email: 'user@test.com', name: 'Test User' };
      mockedQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await getUser('u1');

      expect(result).toEqual(mockUser);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['u1'],
      );
    });

    it('returns null for non-existent user', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getUser('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateUserRole', () => {
    it('updates user role', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await updateUserRole('u1', 'editor');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role'),
        ['editor', 'u1'],
      );
    });
  });

  describe('linkUserToPerson', () => {
    it('links user to person', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await linkUserToPerson('u1', 'p1');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET person_id'),
        ['p1', 'u1'],
      );
    });

    it('unlinks user from person with null', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await linkUserToPerson('u1', null);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET person_id'),
        [null, 'u1'],
      );
    });
  });

  describe('deleteUser', () => {
    it('deletes user by id', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await deleteUser('u1');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM users'),
        ['u1'],
      );
    });
  });

  describe('getInvitations', () => {
    it('returns all invitations', async () => {
      const mockInvitations = [
        { id: 'inv1', email: 'invite1@test.com', role: 'viewer' },
        { id: 'inv2', email: 'invite2@test.com', role: 'editor' },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockInvitations });

      const result = await getInvitations();

      expect(result).toEqual(mockInvitations);
    });

    it('returns empty array when no invitations', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getInvitations();

      expect(result).toEqual([]);
    });
  });

  describe('createInvitation', () => {
    it('creates an invitation with token and expiry', async () => {
      const mockInvitation = {
        id: 'inv1',
        email: 'new@test.com',
        role: 'editor',
        token: 'random-token',
        expires_at: new Date(),
      };
      mockedQuery.mockResolvedValueOnce({ rows: [mockInvitation] });

      const result = await createInvitation(
        'new@test.com',
        'editor',
        'admin-1',
      );

      expect(result).toEqual(mockInvitation);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invitations'),
        expect.arrayContaining(['new@test.com', 'editor', 'admin-1']),
      );
    });
  });

  describe('deleteInvitation', () => {
    it('deletes an invitation by id', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await deleteInvitation('inv1');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM invitations'),
        ['inv1'],
      );
    });
  });

  describe('logAudit', () => {
    it('logs audit entry with all fields', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await logAudit('u1', 'update_person', { personId: 'p1' }, '192.168.1.1');

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        ['u1', 'update_person', { personId: 'p1' }, '192.168.1.1'],
      );
    });

    it('logs audit entry without IP address', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 1 });

      await logAudit('u1', 'delete_person', { personId: 'p1' });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        ['u1', 'delete_person', { personId: 'p1' }, null],
      );
    });
  });

  describe('getAuditLog', () => {
    it('returns audit log with default limit', async () => {
      const mockAuditLog = [
        {
          id: 1,
          user_id: 'u1',
          action: 'update_person',
          email: 'user@test.com',
        },
        {
          id: 2,
          user_id: 'u2',
          action: 'delete_person',
          email: 'admin@test.com',
        },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: mockAuditLog });

      const result = await getAuditLog();

      expect(result).toEqual(mockAuditLog);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('audit_log'),
        [100],
      );
    });

    it('returns audit log with custom limit', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] });

      await getAuditLog(50);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [50],
      );
    });
  });
});
