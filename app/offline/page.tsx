'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center p-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-6">
          <WifiOff className="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You&apos;re Offline
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          It looks like you&apos;ve lost your internet connection. Some features
          may be unavailable until you&apos;re back online.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Previously viewed pages may still be available from cache.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
