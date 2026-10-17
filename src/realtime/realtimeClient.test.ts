import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Kiểm logic ngưỡng RESYNC_GAP_MS (2026-10-17, xem doc comment đầu realtimeClient.ts): reconnect
 * NGẮN (kiểu đổi token mỗi 15 phút, round-trip refreshSession() dưới 1-2 giây) KHÔNG phát resync
 * (tránh banner "dữ liệu vừa đổi" giả mỗi ~15 phút dù không ai sửa gì - bug thật báo qua
 * SpecSteelPage); reconnect DÀI (mất mạng/server restart thật) VẪN phát resync như cũ (không bỏ
 * sót sự kiện thật). Mock `socket.io-client` để điều khiển chính xác khoảng cách
 * disconnect->connect bằng fake timers, không phụ thuộc thời gian thật (vd thử bằng trình duyệt
 * thật phải đợi >44s mới thấy WS rớt do cơ chế ping-timeout của engine.io - quá chậm để test).
 */

type Handler = (...args: unknown[]) => void;
let handlers: Record<string, Handler[]> = {};
let ioMock: (...args: unknown[]) => unknown;

function fire(event: string, ...args: unknown[]): void {
  for (const cb of handlers[event] ?? []) cb(...args);
}

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

vi.mock('../services/core/http', () => ({
  API_BASE_URL: 'http://localhost:3001/api/v1',
  refreshSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/core/tokenStorage', () => ({
  tokenStorage: { getAccessToken: () => 'fake-token' },
}));

describe('RealtimeClient - ngưỡng resync khi reconnect', () => {
  beforeEach(() => {
    handlers = {};
    ioMock = vi.fn(() => {
      const socket = {
        on: (event: string, cb: Handler) => {
          (handlers[event] ??= []).push(cb);
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      return socket;
    });
    (globalThis as unknown as { window: unknown }).window = {};
    vi.useFakeTimers();
  });

  afterEach(async () => {
    const { realtime } = await import('./realtimeClient');
    realtime.stop();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('KHÔNG phát resync khi khoảng ngắt NGẮN hơn ngưỡng (kiểu đổi token)', async () => {
    const { realtime } = await import('./realtimeClient');
    realtime.start();
    fire('connect'); // lần connect đầu tiên - không resync (đúng hành vi cũ)

    const resyncSpy = vi.fn();
    realtime.bus.onResync(resyncSpy);

    fire('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(1500); // ngắn hơn hẳn RESYNC_GAP_MS=5000
    fire('connect'); // reconnect lần 2

    expect(resyncSpy).not.toHaveBeenCalled();
  });

  it('VẪN phát resync khi khoảng ngắt DÀI hơn ngưỡng (mất mạng thật)', async () => {
    const { realtime } = await import('./realtimeClient');
    realtime.start();
    fire('connect'); // lần đầu

    const resyncSpy = vi.fn();
    realtime.bus.onResync(resyncSpy);

    fire('disconnect', 'transport close');
    vi.advanceTimersByTime(8000); // dài hơn hẳn RESYNC_GAP_MS=5000
    fire('connect'); // reconnect lần 2

    expect(resyncSpy).toHaveBeenCalledTimes(1);
  });

  it('phát resync nếu disconnectedAt chưa từng ghi nhận (phòng thủ - an toàn hơn là bỏ sót)', async () => {
    const { realtime } = await import('./realtimeClient');
    realtime.start();
    fire('connect'); // lần đầu

    const resyncSpy = vi.fn();
    realtime.bus.onResync(resyncSpy);

    // Không fire 'disconnect' trước - mô phỏng trường hợp disconnectedAt vẫn null nhưng vẫn có
    // 1 lần 'connect' thứ 2 (lý thuyết không nên xảy ra, nhưng code phải an toàn nếu xảy ra).
    fire('connect');

    expect(resyncSpy).toHaveBeenCalledTimes(1);
  });
});
