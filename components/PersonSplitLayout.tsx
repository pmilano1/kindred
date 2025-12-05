'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import ResearchPanel from './ResearchPanel';

interface PersonSplitLayoutProps {
  personId: string;
  personName: string;
  children: ReactNode;
}

export default function PersonSplitLayout({ personId, personName, children }: PersonSplitLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Remember collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('researchPanelCollapsed');
    if (saved) setCollapsed(saved === 'true');
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('researchPanelCollapsed', String(newState));
  };

  return (
    <div className="flex h-[calc(100vh-180px)] relative">
      {/* Main Content - Left Panel */}
      <div 
        className={`overflow-y-auto transition-all duration-300 pr-4 ${
          collapsed ? 'w-full' : 'w-3/5'
        }`}
      >
        {children}
      </div>

      {/* Collapse/Expand Toggle */}
      <button
        onClick={toggleCollapsed}
        className={`absolute top-0 z-10 bg-amber-100 hover:bg-amber-200 text-amber-800 px-1 py-3 rounded-l transition-all duration-300 ${
          collapsed ? 'right-0' : 'right-[40%]'
        }`}
        title={collapsed ? 'Show Research Panel' : 'Hide Research Panel'}
      >
        {collapsed ? '📚' : '«'}
      </button>

      {/* Research Panel - Right Panel */}
      <div
        className={`overflow-y-auto transition-all duration-300 border-l border-gray-200 pl-4 ${
          collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-2/5 opacity-100'
        }`}
      >
        {!collapsed && (
          <div className="sticky top-0 bg-white pb-2 mb-2 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">📚 Research</h3>
              <Link 
                href={`/tree?person=${personId}&view=ancestors`}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                🌳 Tree View
              </Link>
            </div>
          </div>
        )}
        <ResearchPanel personId={personId} personName={personName} compact={true} />
      </div>

      {/* Floating button when collapsed */}
      {collapsed && (
        <button
          onClick={toggleCollapsed}
          className="fixed right-4 bottom-20 bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-full shadow-lg z-20"
          title="Open Research Panel"
        >
          📚
        </button>
      )}
    </div>
  );
}

