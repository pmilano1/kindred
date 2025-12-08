'use client';

import { ArrowLeft, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button, Input, Label } from '@/components/ui';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const inviteToken = searchParams.get('invite');

  // Redirect to accept-invite if invite token is present
  useEffect(() => {
    if (inviteToken) {
      router.replace(`/accept-invite?token=${inviteToken}`);
    }
  }, [inviteToken, router]);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLoginError('Invalid email or password');
      setIsLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  // Show loading while redirecting to accept-invite
  if (inviteToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <LoadingSpinner
          size="lg"
          className="text-white"
          message="Preparing invitation..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🌳 Family Tree</h1>
          <p className="text-slate-300">Milanese Family History</p>
        </div>

        {(error || loginError) && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-200 text-sm text-center">
              {error === 'AccessDenied'
                ? 'Access denied. You need an invitation to join.'
                : loginError || 'An error occurred. Please try again.'}
            </p>
          </div>
        )}

        {!showEmailLogin ? (
          <>
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
              Sign in with Google
            </Button>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-white/20"></div>
              <span className="px-4 text-slate-400 text-sm">or</span>
              <div className="flex-1 border-t border-white/20"></div>
            </div>

            <Button
              onClick={() => setShowEmailLogin(true)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3"
              icon={<Mail className="w-5 h-5" />}
            >
              Sign in with Email
            </Button>
          </>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300 mb-1">
                Email
              </Label>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-slate-400 focus:ring-green-500"
                placeholder="you@example.com"
                required
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
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              className="w-full font-semibold py-3"
            >
              Sign In
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowEmailLogin(false)}
              className="w-full text-slate-400 hover:text-white text-sm"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to login options
            </Button>
            <a
              href="/forgot-password"
              className="block text-center text-slate-400 hover:text-white text-sm"
            >
              Forgot password?
            </a>
          </form>
        )}

        <p className="text-slate-400 text-xs text-center mt-6">
          This is a private family archive.
          <br />
          You must be invited to access.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <LoadingSpinner size="lg" className="text-white" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
