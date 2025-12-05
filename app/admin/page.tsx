'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Hero from '@/components/Hero';

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
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchData();
  }, [session, status, router]);

  const fetchData = async () => {
    const [usersRes, invitesRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/invitations')
    ]);
    setUsers(await usersRes.json());
    setInvitations(await invitesRes.json());
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!newEmail) return;
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, role: newRole })
    });
    const data = await res.json();
    if (data.inviteUrl) {
      setInviteUrl(data.inviteUrl);
      setNewEmail('');
      fetchData();
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role })
    });
    fetchData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    fetchData();
  };

  const handleDeleteInvite = async (invitationId: string) => {
    await fetch('/api/admin/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId })
    });
    fetchData();
  };

  if (loading) return <><Sidebar /><main className="main-content"><Hero title="User Management" subtitle="Manage users and invitations" /><div className="content-wrapper"><p>Loading...</p></div></main></>;

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Hero title="User Management" subtitle="Manage users and invitations" />
        <div className="content-wrapper">

        {/* Invite Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Invite New User</h2>
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
      </main>
    </>
  );
}

