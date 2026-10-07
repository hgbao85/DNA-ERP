import type { RealtimeEnvelope, RealtimeEventMap, RealtimeEventName } from './contract';

/**
 * Bus sự kiện realtime trong tiến trình trình duyệt - KHÔNG biết gì về socket.io (để test được
 * thuần TS, xem eventBus.test.ts). Đảm bảo 3 việc:
 * - Khử trùng theo eventId: cùng 1 event đến 2 lần (vd sau khi kết nối lại) chỉ phát 1 lần.
 * - Cách ly lỗi: 1 listener ném lỗi không làm hỏng listener khác.
 * - Trả về hàm huỷ đăng ký: component gọi khi unmount để không rò listener.
 *
 * Bus CHỈ phân phối tín hiệu. Không ghi state nghiệp vụ từ payload: listener refetch qua REST.
 */

type AnyHandler = (envelope: RealtimeEnvelope<unknown>) => void;

export interface EventBusOptions {
  /** Số eventId gần nhất giữ lại để khử trùng. Đủ lớn để bao phủ cửa sổ kết nối lại. */
  seenLimit?: number;
  onError?: (error: unknown, name: string) => void;
}

export interface EventBus {
  on<N extends RealtimeEventName>(
    name: N,
    handler: (envelope: RealtimeEnvelope<RealtimeEventMap[N]>) => void,
  ): () => void;
  /** Báo "vừa kết nối lại sau khi mất kết nối": có thể đã lỡ event, listener nên refetch. */
  onResync(handler: () => void): () => void;
  /** Refetch định kỳ khi đang connected (lưới an toàn - event có thể lỡ mà không mất kết nối). */
  onSafetyTick(handler: () => void): () => void;
  /** Trả về false nếu event bị bỏ qua (thiếu eventId hoặc đã thấy rồi). */
  dispatch(name: RealtimeEventName, envelope: RealtimeEnvelope<unknown>): boolean;
  resync(): void;
  safetyTick(): void;
}

export function createEventBus(options: EventBusOptions = {}): EventBus {
  const seenLimit = options.seenLimit ?? 500;
  const onError = options.onError ?? (() => {});
  const handlers = new Map<string, Set<AnyHandler>>();
  const resyncHandlers = new Set<() => void>();
  const safetyHandlers = new Set<() => void>();
  const seen = new Set<string>();
  const seenOrder: string[] = [];

  const markSeen = (eventId: string): boolean => {
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    seenOrder.push(eventId);
    if (seenOrder.length > seenLimit) {
      const oldest = seenOrder.shift();
      if (oldest !== undefined) seen.delete(oldest);
    }
    return true;
  };

  return {
    on(name, handler) {
      let set = handlers.get(name);
      if (!set) {
        set = new Set();
        handlers.set(name, set);
      }
      const fn = handler as AnyHandler;
      set.add(fn);
      return () => {
        handlers.get(name)?.delete(fn);
      };
    },

    onSafetyTick(handler) {
      safetyHandlers.add(handler);
      return () => {
        safetyHandlers.delete(handler);
      };
    },

    safetyTick() {
      for (const fn of [...safetyHandlers]) {
        try {
          fn();
        } catch (error) {
          onError(error, 'safety');
        }
      }
    },

    onResync(handler) {
      resyncHandlers.add(handler);
      return () => {
        resyncHandlers.delete(handler);
      };
    },

    dispatch(name, envelope) {
      if (!envelope || typeof envelope.eventId !== 'string' || envelope.eventId.length === 0) {
        return false;
      }
      if (!markSeen(envelope.eventId)) return false;
      // Chụp bản sao: listener tự huỷ đăng ký trong lúc đang chạy không làm lệch vòng lặp.
      for (const fn of [...(handlers.get(name) ?? [])]) {
        try {
          fn(envelope);
        } catch (error) {
          onError(error, name);
        }
      }
      return true;
    },

    resync() {
      for (const fn of [...resyncHandlers]) {
        try {
          fn();
        } catch (error) {
          onError(error, 'resync');
        }
      }
    },
  };
}
