import React from 'react';

interface LinkProps {
  children: React.ReactNode;
  href: string;
  className?: string;
  [key: string]: unknown;
}

export default function Link({ children, href, className, ...props }: LinkProps) {
  return <a href={href} className={className} {...props}>{children}</a>;
}

