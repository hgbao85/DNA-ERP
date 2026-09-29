import type { NotificationLink } from '../types/admin'

/**
 * Dựng URL `/?m=...&p=...&<params thêm>` từ `Notification.link` - dùng chung cho
 * `NotificationCenter.tsx` (panel) và `MyNotificationsPage.tsx` (trang riêng), tránh 2 nơi tự viết
 * lại logic ghép query string rồi lệch nhau.
 *
 * Trước 2026-09-28 (mục 23 changelog notification), `link.params` được khai báo trong type nhưng
 * KHÔNG nơi nào đọc tới - cả 2 màn chỉ dùng `module`/`page`. Lộ ra khi `WAREHOUSE_TRANSFER_CREATED`
 * cần trỏ vào đúng sub-tab "Nhập nội bộ" của `NhapKhoPage.tsx` (2 sub-tab khác hẳn chức năng, chọn
 * bằng local state, không có route riêng) - phải thêm 1 tham số ngoài `m`/`p` mới đủ.
 */
export function buildNotificationLinkUrl(link: NonNullable<NotificationLink>): string {
  const params = new URLSearchParams()
  params.set('m', link.module)
  if (link.page) params.set('p', link.page)
  if (link.params) {
    for (const [key, value] of Object.entries(link.params)) {
      if (value != null) params.set(key, String(value))
    }
  }
  return `/?${params.toString()}`
}
