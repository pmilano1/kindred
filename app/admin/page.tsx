'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { Send, UserPlus, Trash2, Copy, Mail, RefreshCw } from 'lucide-react';
import { PageHeader, Button, Input, Label, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmailConfigWarning from '@/components/EmailConfigWarning';
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
  image?: string | null;
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
  const [showPassword, setShowPassword] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [createUserError, setCreateUserError] = useState('');



  // Generate a secure random password
  const generatePassword = useCallback(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const length = 16;
    let password = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
    setCreateUserPassword(password);
    setShowPassword(true);
    setRequirePasswordChange(true); // Always require change for generated passwords
  }, []);

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
      <PageHeader title="Admin Panel" subtitle="Manage users and site settings" icon="Settings" />
      <div className="content-wrapper flex justify-center py-12">
        <LoadingSpinner size="lg" message="Loading admin data..." />
      </div>
    </>
  );

  return (
    <>
      <PageHeader title="Admin Panel" subtitle="Manage users and site settings" icon="Settings" />
      <div className="content-wrapper">

        {/* Admin Navigation */}
        <div className="flex gap-4 mb-8">
          <span className="nav-tab-active">Users</span>
          <a href="/admin/settings" className="nav-tab">Site Settings</a>
          <a href="/admin/api-keys" className="nav-tab">API Keys</a>
        </div>

        {/* Email Configuration Warning */}
        <EmailConfigWarning />

        {/* Add User Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Add New User</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => { setShowCreateUser(false); setCreateUserError(''); }}
                variant={!showCreateUser ? 'primary' : 'secondary'}
                size="sm"
                icon={<Mail className="w-4 h-4" />}
              >
                Send Invite
              </Button>
              <Button
                onClick={() => setShowCreateUser(true)}
                variant={showCreateUser ? 'primary' : 'secondary'}
                size="sm"
                icon={<UserPlus className="w-4 h-4" />}
              >
                Create Directly
              </Button>
            </div>
          </div>

          {!showCreateUser ? (
            <>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleInvite} icon={<Send className="w-4 h-4" />}>
                  Send Invite
                </Button>
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
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={createUserEmail} onChange={e => setCreateUserEmail(e.target.value)}
                    placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input type="text" value={createUserName} onChange={e => setCreateUserName(e.target.value)}
                    placeholder="Full Name" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={createUserRole} onValueChange={setCreateUserRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={createUserPassword}
                        onChange={e => { setCreateUserPassword(e.target.value); setShowPassword(false); }}
                        className="pr-16"
                        placeholder="Min 8 characters"
                      />
                      {createUserPassword && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </Button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generatePassword}
                      icon={<RefreshCw className="w-4 h-4" />}
                      title="Generate secure password"
                    >
                      Generate
                    </Button>
                  </div>
                  {showPassword && createUserPassword && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <code className="text-sm text-green-800 font-mono">{createUserPassword}</code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { navigator.clipboard.writeText(createUserPassword); }}
                        title="Copy password"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="require-password-change" checked={requirePasswordChange}
                    onCheckedChange={(checked) => setRequirePasswordChange(checked === true)} />
                  <Label htmlFor="require-password-change" className="cursor-pointer">
                    Require password change on first login
                  </Label>
                </div>
                <Button onClick={handleCreateLocalUser} icon={<UserPlus className="w-4 h-4" />}>
                  Create User
                </Button>
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
                        <Button onClick={() => handleDeleteInvite(inv.id)} variant="ghost" size="sm" className="text-red-600">
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      <code className="text-xs text-gray-600 flex-1 break-all">{inviteLink}</code>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteLink);
                          alert('Link copied!');
                        }}
                        variant="ghost"
                        size="sm"
                        icon={<Copy className="w-3 h-3" />}
                      >
                        Copy
                      </Button>
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
                    <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}
                      disabled={user.id === session?.user?.id}>
                      <SelectTrigger className="w-28 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {user.last_accessed ? new Date(user.last_accessed).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3">
                    {user.id !== session?.user?.id && (
                      <Button onClick={() => handleDeleteUser(user.id)} variant="danger" size="sm" icon={<Trash2 className="w-3 h-3" />}>
                        Delete
                      </Button>
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

