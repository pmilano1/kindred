import { NextResponse } from 'next/server';
import { auth, isAdmin } from '@/lib/auth';
import { getInvitations, createInvitation, deleteInvitation, logAudit } from '@/lib/users';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const invitations = await getInvitations();
  return NextResponse.json(invitations);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email, role } = await request.json();
  
  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 });
  }

  const invitation = await createInvitation(email, role, session.user.id);
  await logAudit(session.user.id, 'create_invitation', { email, role });

  // Generate invitation URL
  const inviteUrl = `${process.env.NEXTAUTH_URL}/login?invite=${invitation.token}`;

  return NextResponse.json({ 
    invitation,
    inviteUrl,
    message: `Invitation created. Share this link with ${email}: ${inviteUrl}`
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { invitationId } = await request.json();
  
  await deleteInvitation(invitationId);
  await logAudit(session.user.id, 'delete_invitation', { invitationId });

  return NextResponse.json({ success: true });
}

