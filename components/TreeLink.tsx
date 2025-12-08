'use client';

import Link from 'next/link';

interface TreeLinkProps {
  personId: string;
  className?: string;
}

export default function TreeLink({ personId, className = '' }: TreeLinkProps) {
  return (
    <Link
      href={`/tree?person=${personId}&view=ancestors`}
      className={`text-gray-400 hover:text-green-600 transition ${className}`}
      title="View in Tree"
      onClick={(e) => e.stopPropagation()}
    >
      🌳
    </Link>
  );
}
