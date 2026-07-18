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

  // Chỉ hiện loading ở lần tải ĐẦU. Refetch sau (đổi deps / gọi tay sau thao tác) giữ data cũ,
  // KHÔNG nháy sang LoadingState → tránh màn hình giật.
  const hasLoaded = useRef(false);
  useEffect(() => {
    let isMounted = true;
    if (!hasLoaded.current) setIsLoading(true);

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
        if (isMounted) {
          setIsLoading(false);
          hasLoaded.current = true;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [tick, ...(deps || [])]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { data, isLoading, error, refetch };
}
