/**
 * Adapter NOTIFICATIONS: FE ⇄ BE thật (module `notifications`).
 * BE chỉ có 3 endpoint: POST tạo, GET list (lọc theo audience của CHÍNH người gọi - ALL + role
 * BOSS/WAREHOUSE_STAFF/PRODUCTION_MANAGER nếu caller giữ role đó - không phải "xem tất cả thông
 * báo đã tạo"), POST :id/read. Không có PATCH/DELETE - NotificationsPage vì vậy bỏ hẳn nút
 * sửa/xóa (xem AdminEntityConfig.api.update/remove optional ở AdminEntityPage.tsx) thay vì gọi
 * vào endpoint không tồn tại.
 * id là UUID string thật (khác phần lớn domain khác dùng bigint-as-string).
 */
import { http } from './core/http';
import type { Notification } from '../types/admin';

type BeAudience = 'ALL' | 'BOSS' | 'WAREHOUSE_STAFF' | 'PRODUCTION_MANAGER';

export interface BeNotification {
  id: string;
  title: string;
  message: string;
  audience: BeAudience;
  createdBy: string | null;
  createdAt: string;
  isRead: boolean;
}

const toFeAudience: Record<BeAudience, Notification['audience']> = {
  ALL: 'all',
  BOSS: 'boss',
  WAREHOUSE_STAFF: 'warehouse_staff',
  PRODUCTION_MANAGER: 'production_manager',
};
const toBeAudience: Record<Notification['audience'], BeAudience> = {
  all: 'ALL',
  boss: 'BOSS',
  warehouse_staff: 'WAREHOUSE_STAFF',
  production_manager: 'PRODUCTION_MANAGER',
};

function toNotification(be: BeNotification): Notification {
  return {
    id: be.id,
    title: be.title,
    message: be.message,
    audience: toFeAudience[be.audience],
    createdAt: be.createdAt,
    createdBy: be.createdBy ?? undefined,
    isRead: be.isRead,
  };
}

export async function getNotifications(): Promise<Notification[]> {
  const res = await http.get<BeNotification[] | { data: BeNotification[] }>('/notifications?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toNotification);
}

export async function createNotification(data: Record<string, unknown>): Promise<Notification> {
  const audience = data.audience as Notification['audience'];
  const created = await http.post<BeNotification>('/notifications', {
    title: data.title,
    message: data.message,
    audience: toBeAudience[audience] ?? 'ALL',
  });
  return toNotification(created);
}

export async function markNotificationRead(id: string): Promise<void> {
  await http.post(`/notifications/${id}/read`, {});
}
