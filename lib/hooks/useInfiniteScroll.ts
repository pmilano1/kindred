'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInfiniteScrollOptions {
  /**
   * Whether there are more items to load
   */
  hasNextPage: boolean;
  /**
   * Whether a fetch is currently in progress
   */
  loading: boolean;
  /**
   * Function to call when more items should be loaded
   */
  onLoadMore: () => void;
  /**
   * Threshold in pixels before the end of the container to trigger load
   * @default 200
   */
  threshold?: number;
  /**
   * Whether infinite scroll is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * CSS selector for the scroll container (uses .content-wrapper by default)
   * Set to null to use viewport
   * @default '.content-wrapper'
   */
  scrollContainerSelector?: string | null;
}

export interface UseInfiniteScrollResult {
  /**
   * Ref to attach to the sentinel element at the end of the list
   */
  sentinelRef: React.RefCallback<HTMLElement>;
  /**
   * Whether content is currently being loaded
   */
  isLoading: boolean;
}

/**
 * Hook for implementing infinite scroll using IntersectionObserver.
 *
 * Usage:
 * ```tsx
 * const { sentinelRef, isLoading } = useInfiniteScroll({
 *   hasNextPage,
 *   loading,
 *   onLoadMore: () => fetchMore({ variables: { after: endCursor } }),
 * });
 *
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} />)}
 *     <div ref={sentinelRef} />
 *     {isLoading && <Spinner />}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll({
  hasNextPage,
  loading,
  onLoadMore,
  threshold = 200,
  enabled = true,
  scrollContainerSelector = '.content-wrapper',
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef(onLoadMore);

  // Keep onLoadMore ref up to date
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Sync isLoading with external loading state
  useEffect(() => {
    if (!loading) {
      setIsLoading(false);
    }
  }, [loading]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // Don't observe if disabled or no more pages
      if (!enabled || !hasNextPage || !node) {
        return;
      }

      // Find the scroll container
      const scrollContainer = scrollContainerSelector
        ? document.querySelector(scrollContainerSelector)
        : null;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          // Only trigger if intersecting and hasNextPage
          // Don't check loading state here to avoid dependency issues
          if (entry.isIntersecting && hasNextPage) {
            setIsLoading(true);
            loadMoreRef.current();
          }
        },
        {
          root: scrollContainer,
          rootMargin: `${threshold}px`,
        },
      );

      observerRef.current.observe(node);
    },
    // Removed 'loading' and 'isLoading' from dependencies to prevent observer recreation
    // The loadMoreRef callback handles the loading check
    [enabled, hasNextPage, threshold, scrollContainerSelector],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { sentinelRef, isLoading };
}
