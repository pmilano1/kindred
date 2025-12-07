'use client';

/**
 * Visual indicator shown in development mode when using the live API proxy.
 * Displays a small badge in the bottom-left corner.
 */
export default function DevApiIndicator() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const isUsingLiveApi = process.env.NEXT_PUBLIC_USE_LIVE_API === 'true';

  if (!isUsingLiveApi) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
      Live API
    </div>
  );
}

