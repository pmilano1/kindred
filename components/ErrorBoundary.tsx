'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Batch errors to avoid flooding the server
let errorQueue: Array<{
  error_message: string;
  stack_trace?: string;
  url: string;
  user_agent: string;
  component_stack?: string;
  error_info?: Record<string, unknown>;
}> = [];

let flushTimeout: NodeJS.Timeout | null = null;

function flushErrors() {
  if (errorQueue.length === 0) return;

  const errors = [...errorQueue];
  errorQueue = [];

  // Send all batched errors
  fetch('/api/log-client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errors[0]), // Send first error (others will be batched in next flush)
  }).catch((err) => {
    console.error('Failed to send error log:', err);
  });

  // If there are more errors, schedule another flush
  if (errorQueue.length > 0) {
    flushTimeout = setTimeout(flushErrors, 1000);
  }
}

async function logError(
  error: Error,
  errorInfo?: { componentStack?: string | null },
) {
  // Only log in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error caught by boundary:', error, errorInfo);
    return;
  }

  // Check if error logging is enabled (from database setting)
  try {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ settings { key value } }',
      }),
    });
    const { data } = await response.json();
    const errorLoggingSetting = data?.settings?.find(
      (s: { key: string; value: string }) => s.key === 'enable_error_logging',
    );
    if (errorLoggingSetting?.value !== 'true') {
      return; // Error logging is disabled
    }
  } catch {
    // If we can't check the setting, don't log errors
    return;
  }

  errorQueue.push({
    error_message: error.message || 'Unknown error',
    stack_trace: error.stack,
    url: window.location.href,
    user_agent: navigator.userAgent,
    component_stack: errorInfo?.componentStack || undefined,
    error_info: {
      name: error.name,
      cause: error.cause,
    },
  });

  // Flush after 1 second (batching)
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  flushTimeout = setTimeout(flushErrors, 1000);
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Error icon"
              >
                <title>Error</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-center text-xl font-semibold text-gray-900">
              Something went wrong
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've been notified and are looking into it.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Reload page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer">Error details</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
