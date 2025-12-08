declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      personId?: string | null;
    };
  }

  interface User {
    id?: string;
    role?: string;
    personId?: string | null;
  }
}

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'admin' | 'editor' | 'viewer';
  account_type: 'user' | 'service';
  description: string | null;
  invited_by: string | null;
  invited_at: Date | null;
  created_at: Date;
  last_login: Date | null;
  person_id: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invited_by: string;
  token: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  user_id: string;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}
