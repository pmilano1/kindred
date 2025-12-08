'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type ButtonLinkVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type ButtonLinkSize = 'sm' | 'md' | 'lg';

interface ButtonLinkProps {
  href: string;
  variant?: ButtonLinkVariant;
  size?: ButtonLinkSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<ButtonLinkVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark border-transparent',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  outline:
    'bg-transparent text-primary border-primary hover:bg-primary hover:text-white',
};

const sizeStyles: Record<ButtonLinkSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export default function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  className = '',
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        border transition-all duration-200 no-underline
        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}
      {children}
      {Icon && iconPosition === 'right' && (
        <Icon className="w-4 h-4 flex-shrink-0" />
      )}
    </Link>
  );
}
