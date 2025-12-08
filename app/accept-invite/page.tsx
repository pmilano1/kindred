'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button, Input, Label } from '@/components/ui';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useGoogle, setUseGoogle] = useState(false);

  const handleLocalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation RegisterWithInvitation($token: String!, $password: String!, $name: String) {
            registerWithInvitation(token: $token, password: $password, name: $name) {
              success
              message
            }
          }`,
          variables: { token, password, name: name || undefined },
        }),
      });

      const data = await response.json();
      if (data.errors || !data.data?.registerWithInvitation?.success) {
        setError(
          data.data?.registerWithInvitation?.message ||
            'Failed to create account',
        );
        setIsLoading(false);
      } else {
        // Auto-login after registration
        window.location.href = '/login?registered=true';
      }
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full mx-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Invalid Invitation
          </h1>
          <p className="text-slate-300 mb-6">
            This invitation link is invalid or has expired.
          </p>
          <Link href="/login" className="text-green-400 hover:text-green-300">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🌳 Welcome!</h1>
          <p className="text-slate-300">
            Create your account to join the family tree
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-200 text-sm text-center">{error}</p>
          </div>
        )}

        {!useGoogle ? (
          <form onSubmit={handleLocalRegister} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-300 mb-1">
                Your Name
              </Label>
              <Input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-slate-400 focus:ring-green-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300 mb-1">
                Password
              </Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-slate-400 focus:ring-green-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-slate-300 mb-1">
                Confirm Password
              </Label>
              <Input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-slate-400 focus:ring-green-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              className="w-full font-semibold py-3"
            >
              Create Account
            </Button>
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-white/20"></div>
              <span className="px-4 text-slate-400 text-sm">or</span>
              <div className="flex-1 border-t border-white/20"></div>
            </div>
            <Button
              type="button"
              onClick={() => setUseGoogle(true)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3"
            >
              Use Google Account Instead
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 shadow-lg hover:shadow-xl"
            >
              <svg
                className="w-5 h-5 mr-2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUseGoogle(false)}
              className="w-full text-slate-400 hover:text-white text-sm"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Use email & password instead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <LoadingSpinner size="lg" className="text-white" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
