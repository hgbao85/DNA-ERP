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
        if (isMounted) setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
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

  // Vá cache tại chỗ bằng kết quả đã có sẵn trong tay (vd response của 1 lần ghi vừa gọi) -
  // tránh phải gọi lại refetch() (round-trip mạng + tải lại CẢ danh sách) chỉ để đồng bộ 1 bản
  // ghi vừa đổi. Cần cho các thao tác gọi liên tục (vd tạm lưu debounce mỗi giây) - refetch()
  // mỗi lần sẽ tốn mạng vô ích, mutate() chỉ cập nhật state cục bộ.
  const mutate = useCallback((updater: (prev: T | null) => T | null) => {
    setData(updater);
  }, []);

  return { data, isLoading, error, refetch, mutate };
}
