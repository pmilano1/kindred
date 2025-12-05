'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import ResearchPanel from './ResearchPanel';

interface PersonPageLayoutProps {
  personId: string;
  personName: string;
  children: ReactNode;
}

export default function PersonPageLayout({ personId, personName, children }: PersonPageLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Persist collapsed state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('researchPanelCollapsed');
    if (saved) setIsCollapsed(saved === 'true');
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('researchPanelCollapsed', String(newState));
  };

  return (
    <div className="flex h-[calc(100vh-180px)] relative">
      {/* Main Content - Left Side */}
      <div 
        className={`overflow-y-auto transition-all duration-300 ${
          isCollapsed ? 'w-full pr-12' : 'w-3/5 pr-4'
        }`}
      >
        {/* Tree View Links */}
        <div className="flex gap-2 mb-4">
          <Link 
            href={`/tree?person=${personId}&view=ancestors`}
            className="tree-btn text-sm flex items-center gap-1"
          >
            🌳 Ancestors
          </Link>
          <Link 
            href={`/tree?person=${personId}&view=descendants`}
            className="tree-btn text-sm flex items-center gap-1"
          >
            👨‍👩‍👧‍👦 Descendants
          </Link>
        </div>

        {children}
      </div>

      {/* Research Panel - Right Side */}
      <div 
        className={`transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'w-0' : 'w-2/5'
        }`}
      >
        <div className="h-full overflow-y-auto pl-4 border-l border-gray-200">
          <ResearchPanel personId={personId} personName={personName} />
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleCollapsed}
        className={`absolute top-0 z-10 bg-amber-100 hover:bg-amber-200 text-amber-800 
          p-2 rounded-l shadow-md transition-all duration-300 ${
          isCollapsed ? 'right-0' : 'right-[40%]'
        }`}
        title={isCollapsed ? 'Show Research Panel' : 'Hide Research Panel'}
      >
        {isCollapsed ? '📚 «' : '»'}
      </button>

      {/* Floating button when collapsed */}
      {isCollapsed && (
        <button
          onClick={toggleCollapsed}
          className="fixed bottom-20 right-4 bg-amber-500 hover:bg-amber-600 text-white 
            p-4 rounded-full shadow-lg z-20 flex items-center gap-2"
          title="Open Research Panel"
        >
          📚
        </button>
      )}
    </div>
  );
}

