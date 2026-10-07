import { io, type Socket } from 'socket.io-client';
import { ApiError } from '../services/core/apiError';
import { API_BASE_URL, refreshSession } from '../services/core/http';
import { tokenStorage } from '../services/core/tokenStorage';
import { REALTIME_EVENTS } from './contract';
import { createEventBus, type EventBus } from './eventBus';

/**
 * Kết nối realtime DUY NHẤT của cả trình duyệt. Không component nào được tự gọi io(): mọi nơi
 * đăng ký nghe qua `realtime.bus` (hoặc hook trong hooks.ts), trạng thái qua `realtime.subscribeStatus`.
 *
 * - idle: chưa đăng nhập / đã đăng xuất (không mở socket).
 * - connecting: đang bắt tay.
 * - connected: đang nhận sự kiện.
 * - disconnected: mất kết nối - UI dựa vào đây để bật polling dự phòng.
 *
 * Xác thực: token lấy TẠI THỜI ĐIỂM mỗi lần kết nối (hàm `auth`), nên sau khi refresh token, lần
 * tự kết nối lại dùng token mới. Token bị từ chối (hết hạn) -> refreshSession() rồi connect() lại.
 * Refresh lỗi mạng -> thử lại có giãn cách. Refresh báo 401 (phiên thật sự hết) -> dừng; AuthContext
 * sẽ đăng xuất qua luồng REST sẵn có.
 *
 * Kết nối lại: sau lần connect thứ 2 trở đi, phát `resync` để mọi màn hình refetch - sự kiện phát
 * trong lúc mất mạng không được replay, nên phải tải lại dữ liệu thật từ REST.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

/** Mặc định suy từ API base URL (bỏ path /api/v1) - socket.io gắn ở /socket.io của origin. */
const SOCKET_URL = process.env.NEXT_PUBLIC_REALTIME_URL || new URL(API_BASE_URL).origin;
const SOCKET_PATH = '/socket.io';
const RETRY_REFRESH_MS = 5_000;
/** Chu kỳ refetch dự phòng khi đang connected (event có thể lỡ trong lúc Redis/mạng chập chờn). */
const SAFETY_TICK_MS = 5 * 60 * 1000;

class RealtimeClient {
  readonly bus: EventBus = createEventBus({
    onError: (error, name) => console.error(`[realtime] listener của "${name}" lỗi`, error),
  });

  private socket: Socket | null = null;
  private status: RealtimeStatus = 'idle';
  private everConnected = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setInterval> | null = null;
  private statusListeners = new Set<() => void>();

  getStatus = (): RealtimeStatus => this.status;

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  /** Gọi khi đã có access token. Idempotent: gọi lại khi đang chạy thì không làm gì. */
  start(): void {
    if (typeof window === 'undefined' || this.socket) return;
    if (!tokenStorage.getAccessToken()) return;

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: tokenStorage.getAccessToken(), correlationId: newCorrelationId() }),
      reconnectionDelayMax: 10_000,
    });
    this.socket = socket;
    this.setStatus('connecting');

    socket.on('connect', () => {
      this.setStatus('connected');
      if (this.everConnected) this.bus.resync();
      this.everConnected = true;
    });

    socket.on('disconnect', (reason) => {
      this.setStatus('disconnected');
      // Server chủ động ngắt (token hết hạn / server đang tắt): socket.io KHÔNG tự kết nối lại,
      // phải tự làm sau khi có token mới.
      if (reason === 'io server disconnect') void this.recover();
    });

    socket.on('connect_error', (error) => {
      this.setStatus('disconnected');
      // Middleware từ chối handshake: socket.io cũng không tự thử lại - phải refresh rồi connect().
      if (error.message === 'UNAUTHORIZED') void this.recover();
    });

    for (const name of Object.values(REALTIME_EVENTS)) {
      socket.on(name, (envelope: Parameters<EventBus['dispatch']>[1]) => {
        this.bus.dispatch(name, envelope);
      });
    }
  }

  /** Gọi khi đăng xuất hoặc unmount. Huỷ mọi timer, đóng socket. */
  stop(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
    this.everConnected = false;
    this.setStatus('idle');
  }

  /** Chỉ chạy khi đang connected; dừng ngay khi mất kết nối hoặc đăng xuất. */
  private syncSafetyTimer(): void {
    if (this.status === 'connected' && !this.safetyTimer) {
      this.safetyTimer = setInterval(() => this.bus.safetyTick(), SAFETY_TICK_MS);
    } else if (this.status !== 'connected' && this.safetyTimer) {
      clearInterval(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  private async recover(): Promise<void> {
    if (!this.socket) return;
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        // Phiên thật sự hết hạn: dừng, để luồng REST/AuthContext xử lý đăng xuất.
        this.stop();
        return;
      }
      // Lỗi mạng/server tạm thời: thử lại sau.
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.recover();
      }, RETRY_REFRESH_MS);
      return;
    }
    this.socket?.connect();
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.syncSafetyTimer();
    for (const listener of [...this.statusListeners]) listener();
  }
}

function newCorrelationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const realtime = new RealtimeClient();
