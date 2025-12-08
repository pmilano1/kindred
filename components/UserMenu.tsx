'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui';

export default function UserMenu() {
  const { data: session, status } = useSession();

  // Don't render during loading or if not authenticated
  if (status === 'loading' || status === 'unauthenticated' || !session?.user) {
    return null;
  }

  const user = session.user;
  const isAdmin = user.role === 'admin';
  const initials =
    user.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent"
        >
          <Avatar className="h-9 w-9 border-2 border-white/30 hover:border-white/50 transition-colors cursor-pointer">
            {user.image && (
              <AvatarImage src={user.image} alt={user.name || 'User'} />
            )}
            <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end" sideOffset={8}>
        <DropdownMenuLabel className="font-normal pb-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Admin
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
