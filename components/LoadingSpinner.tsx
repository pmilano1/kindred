'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  message,
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <output
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div
        className={`${sizeClasses[size]} border-gray-200 border-t-green-600 rounded-full animate-spin`}
        aria-hidden="true"
      />
      {message && (
        <p className="text-gray-500 text-sm animate-pulse">{message}</p>
      )}
    </output>
  );
}
