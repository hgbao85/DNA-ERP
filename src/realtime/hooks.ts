'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { REALTIME_EVENTS, type EntityChangedPayload, type RealtimeEventMap, type RealtimeEventName } from './contract';
import { realtime, type RealtimeStatus } from './realtimeClient';

/** Trạng thái kết nối hiện tại. UI dùng để hiện chấm trạng thái và bật polling dự phòng. */
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus, () => 'idle');
}

/**
 * Nghe 1 event. Handler được giữ bản mới nhất qua ref, nên không cần bọc useCallback ở caller;
 * listener được huỷ khi unmount.
 */
export function useRealtimeEvent<N extends RealtimeEventName>(
  name: N,
  handler: (payload: RealtimeEventMap[N]) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(
    () =>
      realtime.bus.on(name, (envelope) => {
        handlerRef.current(envelope.payload);
      }),
    [name],
  );
}

interface RealtimeRefetchOptions {
  /** Gom các event dồn dập (vd nhiều dòng cùng 1 lần duyệt) thành 1 lần refetch. */
  debounceMs?: number;
}

/**
 * Refetch danh sách khi có entity thuộc topic quan tâm đổi, và khi VỪA KẾT NỐI LẠI (đã có thể lỡ
 * event trong lúc mất mạng). Chỉ refetch - không ghi state từ payload - nên luôn đúng với DB.
 *
 * `refetch` có thể là `refetch` của useFetch hoặc hàm bất kỳ; luôn gọi bản mới nhất.
 */
export function useRealtimeRefetch(
  topics: readonly string[],
  refetch: () => void,
  options: RealtimeRefetchOptions = {},
): void {
  const { debounceMs = 400 } = options;
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  });

  const topicsKey = [...topics].sort().join('|');

  useEffect(() => {
    if (topicsKey === '') return;
    const wanted = new Set(topicsKey.split('|'));
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refetchRef.current();
      }, delay);
    };

    const offEntity = realtime.bus.on(REALTIME_EVENTS.ENTITY_CHANGED, (envelope) => {
      const payload: EntityChangedPayload = envelope.payload;
      if (payload.topics.some((t) => wanted.has(t))) schedule(debounceMs);
    });
    const offResync = realtime.bus.onResync(() => schedule(0));
    const offSafety = realtime.bus.onSafetyTick(() => schedule(0));

    return () => {
      offEntity();
      offResync();
      offSafety();
      if (timer) clearTimeout(timer);
    };
  }, [topicsKey, debounceMs]);
}

/**
 * Cờ "dữ liệu vừa được cập nhật" cho màn đang có form/kế hoạch người dùng đang thao tác: KHÔNG tự
 * refetch (tránh mất dữ liệu đang nhập); chỉ bật cờ để UI hiện thông báo, người dùng tự bấm tải lại.
 * Bật cả khi kết nối lại (có thể đã lỡ event).
 */
export function useRealtimeChangeNotice(topics: readonly string[]): { changed: boolean; clear: () => void } {
  const [changed, setChanged] = useState(false);
  const topicsKey = [...topics].sort().join('|');

  useEffect(() => {
    if (topicsKey === '') return;
    const wanted = new Set(topicsKey.split('|'));
    const offEntity = realtime.bus.on(REALTIME_EVENTS.ENTITY_CHANGED, (envelope) => {
      if (envelope.payload.topics.some((t) => wanted.has(t))) setChanged(true);
    });
    const offResync = realtime.bus.onResync(() => setChanged(true));
    return () => {
      offEntity();
      offResync();
    };
  }, [topicsKey]);

  const clear = useCallback(() => setChanged(false), []);
  return { changed, clear };
}
