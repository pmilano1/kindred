'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  GET_USERS,
  GET_INVITATIONS,
  CREATE_INVITATION,
  DELETE_INVITATION,
  UPDATE_USER_ROLE,
  DELETE_USER,
  CREATE_LOCAL_USER
} from '@/lib/graphql/queries';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  last_login: string | null;
  last_accessed: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [inviteUrl, setInviteUrl] = useState('');

  // Create local user state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createUserRole, setCreateUserRole] = useState('viewer');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [createUserError, setCreateUserError] = useState('');

  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery<{ users: User[] }>(GET_USERS);
  const { data: invitationsData, loading: invitationsLoading, refetch: refetchInvitations } = useQuery<{ invitations: Invitation[] }>(GET_INVITATIONS);

  const [createInvitation] = useMutation(CREATE_INVITATION);
  const [deleteInvitation] = useMutation(DELETE_INVITATION);
  const [updateUserRole] = useMutation(UPDATE_USER_ROLE);
  const [deleteUser] = useMutation(DELETE_USER);
  const [createLocalUser] = useMutation(CREATE_LOCAL_USER);

  const users = usersData?.users || [];
  const invitations = invitationsData?.invitations || [];
  const loading = usersLoading || invitationsLoading;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  const handleInvite = async () => {
    if (!newEmail) return;
    try {
      const result = await createInvitation({ variables: { email: newEmail, role: newRole } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invitation = (result.data as any)?.createInvitation as Invitation | undefined;
      if (invitation?.token) {
        setInviteUrl(`${window.location.origin}/login?invite=${invitation.token}`);
        setNewEmail('');
        refetchInvitations();
      }
    } catch (err) {
      console.error('Failed to create invitation:', err);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole({ variables: { userId, role } });
      refetchUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser({ variables: { userId } });
      refetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const handleDeleteInvite = async (invitationId: string) => {
    try {
      await deleteInvitation({ variables: { id: invitationId } });
      refetchInvitations();
    } catch (err) {
      console.error('Failed to delete invitation:', err);
    }
  };

  const handleCreateLocalUser = async () => {
    if (!createUserEmail || !createUserName || !createUserPassword) {
      setCreateUserError('All fields are required');
      return;
    }
    if (createUserPassword.length < 8) {
      setCreateUserError('Password must be at least 8 characters');
      return;
    }
    setCreateUserError('');
    try {
      await createLocalUser({
        variables: {
          email: createUserEmail,
          name: createUserName,
          role: createUserRole,
          password: createUserPassword,
          requirePasswordChange
        }
      });
      setCreateUserEmail('');
      setCreateUserName('');
      setCreateUserPassword('');
      setCreateUserRole('viewer');
      setRequirePasswordChange(true);
      setShowCreateUser(false);
      refetchUsers();
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  if (loading) return (
    <>
      <PageHeader title="Admin Panel" subtitle="Manage users and site settings" icon={Settings} />
      <div className="content-wrapper flex justify-center py-12">
        <LoadingSpinner size="lg" message="Loading admin data..." />
      </div>
    </>
  );

  return (
    <>
      <PageHeader title="Admin Panel" subtitle="Manage users and site settings" icon={Settings} />
      <div className="content-wrapper">

        {/* Admin Navigation */}
        <div className="flex gap-4 mb-8">
          <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">Users</span>
          <a href="/admin/settings" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            Site Settings
          </a>
          <a href="/admin/api-keys" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            API Keys
          </a>
        </div>

        {/* Add User Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Add New User</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateUser(false); setCreateUserError(''); }}
                className={`px-3 py-1 rounded-lg text-sm ${!showCreateUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Send Invite
              </button>
              <button
                onClick={() => setShowCreateUser(true)}
                className={`px-3 py-1 rounded-lg text-sm ${showCreateUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Create Directly
              </button>
            </div>
          </div>

          {!showCreateUser ? (
            <>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border rounded-lg px-3 py-2">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button onClick={handleInvite} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Send Invite
                </button>
              </div>
              {inviteUrl && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-1">Share this link:</p>
                  <code className="text-xs bg-green-100 p-1 rounded break-all">{inviteUrl}</code>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">Create a local user account directly without sending an invitation email.</p>
              {createUserError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{createUserError}</div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={createUserEmail} onChange={e => setCreateUserEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={createUserName} onChange={e => setCreateUserName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Full Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={createUserRole} onChange={e => setCreateUserRole(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                  <input type="password" value={createUserPassword} onChange={e => setCreateUserPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Min 8 characters" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={requirePasswordChange} onChange={e => setRequirePasswordChange(e.target.checked)}
                    className="rounded border-gray-300" />
                  Require password change on first login
                </label>
                <button onClick={handleCreateLocalUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Create User
                </button>
              </div>
            </>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
          {invitations.filter(i => !i.accepted_at).length === 0 ? (
            <p className="text-gray-500">No pending invitations</p>
          ) : (
            <div className="space-y-3">
              {invitations.filter(i => !i.accepted_at).map(inv => {
                const inviteLink = `${window.location.origin}/login?invite=${inv.token}`;
                return (
                  <div key={inv.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{inv.email}</span>
                        <span className="ml-2 text-sm text-gray-500 capitalize">({inv.role})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                        <button onClick={() => handleDeleteInvite(inv.id)} className="text-red-600 text-sm hover:underline">Cancel</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      <code className="text-xs text-gray-600 flex-1 break-all">{inviteLink}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteLink);
                          alert('Link copied!');
                        }}
                        className="text-blue-600 text-xs hover:underline whitespace-nowrap"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Users ({users.length})</h2>
          <table className="w-full">
            <thead><tr className="text-left text-sm text-gray-500 border-b">
              <th className="pb-2">User</th><th className="pb-2">Role</th><th className="pb-2">Last Login</th><th className="pb-2">Last Accessed</th><th></th>
            </tr></thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b">
                  <td className="py-3">
                    <div className="font-medium">{user.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="py-3">
                    <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                      disabled={user.id === session?.user?.id} className="border rounded px-2 py-1 text-sm">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {user.last_accessed ? new Date(user.last_accessed).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3">
                    {user.id !== session?.user?.id && (
                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 text-sm">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

