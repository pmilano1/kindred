'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kindred-recent-searches';
const MAX_SEARCHES = 10;

export interface RecentSearch {
  query: string;
  timestamp: number;
}

// Helper to get searches from localStorage
function getStoredSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Subscribe to storage events for cross-tab sync
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useRecentSearches() {
  // Use useSyncExternalStore for localStorage to avoid setState in useEffect
  const storedSearches = useSyncExternalStore(
    subscribe,
    getStoredSearches,
    () => [] // Server snapshot
  );
  
  // Local state for immediate updates (before storage event fires)
  const [localSearches, setLocalSearches] = useState<RecentSearch[] | null>(null);
  
  // Use local state if set, otherwise use stored
  const searches = localSearches ?? storedSearches;

  // Add a search to history
  const addSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    const current = getStoredSearches();
    // Remove duplicates and add new search at the beginning
    const filtered = current.filter(s => s.query.toLowerCase() !== query.toLowerCase());
    const updated = [{ query: query.trim(), timestamp: Date.now() }, ...filtered].slice(0, MAX_SEARCHES);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    
    setLocalSearches(updated);
  }, []);

  // Remove a specific search
  const removeSearch = useCallback((query: string) => {
    const current = getStoredSearches();
    const updated = current.filter(s => s.query !== query);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
    setLocalSearches(updated);
  }, []);

  // Clear all searches
  const clearSearches = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    setLocalSearches([]);
  }, []);

  return {
    searches,
    addSearch,
    removeSearch,
    clearSearches,
  };
}

