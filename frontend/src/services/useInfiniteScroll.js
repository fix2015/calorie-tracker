import { useRef, useEffect, useCallback } from 'react';

export function useInfiniteScroll(fetchMore, enabled = true) {
  const sentinelRef = useRef(null);
  const stableFetch = useCallback(fetchMore, [fetchMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) stableFetch();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stableFetch, enabled]);

  return sentinelRef;
}
