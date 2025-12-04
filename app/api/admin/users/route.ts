import { NextResponse } from 'next/server';
import { auth, isAdmin } from '@/lib/auth';
import { getUsers, updateUserRole, deleteUser, logAudit } from '@/lib/users';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const users = await getUsers();
  return NextResponse.json(users);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId, role } = await request.json();
  
  // Prevent removing own admin rights
  if (userId === session.user.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
  }

  await updateUserRole(userId, role);
  await logAudit(session.user.id, 'update_user_role', { targetUserId: userId, newRole: role });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId } = await request.json();
  
  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  await deleteUser(userId);
  await logAudit(session.user.id, 'delete_user', { deletedUserId: userId });

  return NextResponse.json({ success: true });
}

