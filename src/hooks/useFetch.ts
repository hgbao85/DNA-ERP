import { useState, useEffect, useCallback, useRef } from 'react';

export function useFetch<T>(fetchFn: () => Promise<T>, deps?: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep a ref to the latest fetchFn to avoid stale closures
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchFnRef.current()
      .then((resData) => {
        if (isMounted) {
          setData(resData);
          setError(null);
        }
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        if (isMounted) setError('Không thể tải dữ liệu');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tick, ...(deps || [])]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { data, isLoading, error, refetch };
}
