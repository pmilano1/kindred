'use client';

import { useEffect, useState } from 'react';

export function GlobalErrorHandler() {
  const [errorLoggingEnabled, setErrorLoggingEnabled] = useState(false);

  useEffect(() => {
    // Only enable in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Check if error logging is enabled
    fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ settings { key value } }',
      }),
    })
      .then((res) => res.json())
      .then(({ data }) => {
        const setting = data?.settings?.find(
          (s: { key: string; value: string }) =>
            s.key === 'enable_error_logging',
        );
        setErrorLoggingEnabled(setting?.value === 'true');
      })
      .catch(() => {
        setErrorLoggingEnabled(false);
      });
  }, []);

  useEffect(() => {
    // Only enable in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Handle unhandled errors
    const handleError = (event: ErrorEvent) => {
      if (!errorLoggingEnabled) return;

      event.preventDefault(); // Prevent default browser error handling

      fetch('/api/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: event.message || 'Unknown error',
          stack_trace: event.error?.stack,
          url: window.location.href,
          user_agent: navigator.userAgent,
          error_info: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        }),
      }).catch((err) => {
        console.error('Failed to send error log:', err);
      });
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!errorLoggingEnabled) return;

      event.preventDefault(); // Prevent default browser handling

      const error = event.reason;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;

      fetch('/api/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: `Unhandled Promise Rejection: ${errorMessage}`,
          stack_trace: stackTrace,
          url: window.location.href,
          user_agent: navigator.userAgent,
          error_info: {
            type: 'unhandledrejection',
          },
        }),
      }).catch((err) => {
        console.error('Failed to send error log:', err);
      });
    };

    // Add event listeners only if error logging is enabled
    if (errorLoggingEnabled) {
      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleRejection);
    }

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [errorLoggingEnabled]);

  return null; // This component doesn't render anything
}
