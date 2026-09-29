/**
 * Adapter NOTIFICATIONS: FE ⇄ BE thật (module `notifications`).
 * 2026-09-25: BE đổi từ broadcast-4-audience sang fan-out theo người nhận (xem
 * docs/changelog-2026-09-25-notification-review-va-plan.md bên DNA-ERP-BE) — `GET /notifications`
 * giờ trả "thông báo của TÔI" (đã fan-out sẵn), không còn lọc audience thủ công ở BE theo role của
 * caller như trước; mỗi dòng có thêm category/severity/entityType/entityId/link để
 * NotificationCenter hiển thị + điều hướng đúng chỗ. `POST /notifications` (tạo announcement,
 * audience-based) và `POST /notifications/:id/read` giữ nguyên path cũ.
 * id là UUID string thật (khác phần lớn domain khác dùng bigint-as-string).
 */
import { http } from './core/http';
import type { Announcement, Notification, NotificationCategory } from '../types/admin';

type BeAudience = 'ALL' | 'BOSS' | 'WAREHOUSE_STAFF' | 'PRODUCTION_MANAGER';

export interface BeNotification {
  id: string;
  type: string | null;
  category: NotificationCategory;
  severity: Notification['severity'];
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  link: Notification['link'];
  data: unknown;
  actorId: string | null;
  audience: BeAudience | null;
  createdBy: string | null;
  createdAt: string;
  isRead: boolean;
  isResolved: boolean;
}

export interface BeAnnouncement {
  id: string;
  title: string;
  message: string;
  audience: BeAudience | null;
  createdBy: string | null;
  createdAt: string;
  recipientCount: number;
  readCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const toFeAudience: Record<BeAudience, NonNullable<Notification['audience']>> = {
  ALL: 'all',
  BOSS: 'boss',
  WAREHOUSE_STAFF: 'warehouse_staff',
  PRODUCTION_MANAGER: 'production_manager',
};
const toBeAudience: Record<NonNullable<Notification['audience']>, BeAudience> = {
  all: 'ALL',
  boss: 'BOSS',
  warehouse_staff: 'WAREHOUSE_STAFF',
  production_manager: 'PRODUCTION_MANAGER',
};

function toNotification(be: BeNotification): Notification {
  return {
    id: be.id,
    type: be.type,
    category: be.category,
    severity: be.severity,
    title: be.title,
    message: be.message,
    entityType: be.entityType,
    entityId: be.entityId,
    link: be.link,
    data: be.data,
    audience: be.audience ? toFeAudience[be.audience] : null,
    createdAt: be.createdAt,
    createdBy: be.createdBy,
    isRead: be.isRead,
    isResolved: be.isResolved,
  };
}

function toAnnouncement(be: BeAnnouncement): Announcement {
  return {
    id: be.id,
    title: be.title,
    message: be.message,
    audience: be.audience ? toFeAudience[be.audience] : null,
    createdBy: be.createdBy,
    createdAt: be.createdAt,
    recipientCount: be.recipientCount,
    readCount: be.readCount,
  };
}

export interface ListNotificationsParams {
  /** Đã đọc hay chưa (readAt). */
  status?: 'unread' | 'all';
  /** Đã xử lý xong hay chưa (resolvedAt) - KHÁC `status`. NotificationCenter dùng field này cho
   *  tab "Cần xử lý" (resolved: 'false'), KHÔNG dùng status=unread - bấm đọc 1 thông báo cần
   *  duyệt không được làm nó biến mất khỏi "Cần xử lý" khi việc thật vẫn chưa xong. */
  resolved?: 'true' | 'false';
  category?: NotificationCategory;
  page?: number;
  limit?: number;
}

/** Danh sách thông báo CỦA NGƯỜI GỌI, mới nhất trước. Mặc định `limit=100` (giữ hành vi cũ - trang
 *  "Thông báo của tôi"/panel tự phân trang nếu cần sau này, chưa cần lúc này vì khối lượng nhỏ). */
export async function getNotifications(params: ListNotificationsParams = {}): Promise<PaginatedResult<Notification>> {
  const query = new URLSearchParams();
  query.set('limit', String(params.limit ?? 100));
  query.set('page', String(params.page ?? 1));
  if (params.status) query.set('status', params.status);
  if (params.resolved) query.set('resolved', params.resolved);
  if (params.category) query.set('category', params.category);
  const res = await http.get<PaginatedResult<BeNotification>>(`/notifications?${query.toString()}`);
  return { data: res.data.map(toNotification), meta: res.meta };
}

export async function getUnreadCount(): Promise<{ total: number; byCategory: Record<string, number> }> {
  return http.get('/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const updated = await http.post<BeNotification>(`/notifications/${id}/read`, {});
  return toNotification(updated);
}

export async function markAllNotificationsRead(category?: NotificationCategory): Promise<{ count: number }> {
  const qs = category ? `?category=${category}` : '';
  return http.post(`/notifications/read-all${qs}`, {});
}

export async function archiveNotification(id: string): Promise<void> {
  await http.post(`/notifications/${id}/archive`, {});
}

/** Admin tạo thông báo chung (ANNOUNCEMENT) - giữ nguyên payload cũ, BE tự bỏ qua createdBy gửi
 *  lên (server lấy từ JWT). */
export async function createNotification(data: Record<string, unknown>): Promise<Notification> {
  const audience = data.audience as NonNullable<Notification['audience']>;
  const created = await http.post<BeNotification>('/notifications', {
    title: data.title,
    message: data.message,
    audience: toBeAudience[audience] ?? 'ALL',
  });
  return toNotification(created);
}

/** Admin xem lại MỌI thông báo chung đã phát + tỉ lệ đã đọc - khác `getNotifications()` (chỉ thấy
 *  của chính mình). */
export async function getSentAnnouncements(page = 1, limit = 50): Promise<PaginatedResult<Announcement>> {
  const res = await http.get<PaginatedResult<BeAnnouncement>>(`/notifications/sent?page=${page}&limit=${limit}`);
  return { data: res.data.map(toAnnouncement), meta: res.meta };
}
