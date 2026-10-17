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
  /** Lọc thêm SAU khi đã khớp topic - cùng ý nghĩa với ChangeNoticeOptions.filter (xem dưới). Dùng
   *  khi màn CHỈ đáng tự refetch nếu đúng bản ghi đang mở đổi, không phải mọi bản ghi cùng loại.
   *  KHÔNG áp dụng cho nhánh resync/safetyTick (không có entityId cụ thể để lọc). */
  filter?: (payload: EntityChangedPayload) => boolean;
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
  const filterRef = useRef(options.filter);
  useEffect(() => {
    refetchRef.current = refetch;
    filterRef.current = options.filter;
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
      if (!payload.topics.some((t) => wanted.has(t))) return;
      if (filterRef.current && !filterRef.current(payload)) return;
      schedule(debounceMs);
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

interface ChangeNoticeOptions {
  /**
   * Lọc thêm SAU khi đã khớp topic - vd màn đang mở CHI TIẾT 1 bản ghi chỉ nên báo khi đúng bản
   * ghi đó đổi, không phải MỌI bản ghi cùng loại (2026-10-17, phát hiện qua SpecSteelPage: mở
   * định mức mảnh của 1 SKU nhưng cứ SKU bất kỳ khác đổi ở đâu đó cũng bật banner - topic 'skus'
   * vốn dùng chung cho cả màn danh sách lẫn màn chi tiết, không tách được theo entityId nếu không
   * lọc thêm ở đây). Bỏ trống = giữ hành vi cũ (khớp topic là đủ, dùng cho màn DANH SÁCH - đổi bản
   * ghi nào trong danh sách cũng đáng báo). KHÔNG áp dụng cho nhánh resync (xem dưới) - resync
   * không có entityId cụ thể để lọc, luôn phải báo vì không biết chắc đã lỡ đúng bản ghi nào.
   */
  filter?: (payload: EntityChangedPayload) => boolean;
}

/**
 * Cờ "dữ liệu vừa được cập nhật" cho màn đang có form/kế hoạch người dùng đang thao tác: KHÔNG tự
 * refetch (tránh mất dữ liệu đang nhập); chỉ bật cờ để UI hiện thông báo, người dùng tự bấm tải lại.
 * Bật cả khi kết nối lại (có thể đã lỡ event) - xem `realtimeClient.ts` cho phần đã bớt tần suất
 * resync giả (reconnect do access token hết hạn 15 phút, không phải dữ liệu thật đổi).
 */
export function useRealtimeChangeNotice(
  topics: readonly string[],
  options: ChangeNoticeOptions = {},
): { changed: boolean; clear: () => void } {
  const [changed, setChanged] = useState(false);
  const topicsKey = [...topics].sort().join('|');
  const filterRef = useRef(options.filter);
  useEffect(() => {
    filterRef.current = options.filter;
  });

  useEffect(() => {
    if (topicsKey === '') return;
    const wanted = new Set(topicsKey.split('|'));
    const offEntity = realtime.bus.on(REALTIME_EVENTS.ENTITY_CHANGED, (envelope) => {
      const payload = envelope.payload;
      if (!payload.topics.some((t) => wanted.has(t))) return;
      if (filterRef.current && !filterRef.current(payload)) return;
      setChanged(true);
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
