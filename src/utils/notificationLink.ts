import type { Notification, NotificationLink } from '../types/admin'
import type { User } from '../context/AuthContext'
import { isDirector, resolveDefaultModule } from './resolveDefaultModule'

/**
 * Dựng URL `/?m=...&p=...&<params thêm>` từ `Notification.link` - dùng chung cho
 * `NotificationCenter.tsx` (panel) và `MyNotificationsPage.tsx` (trang riêng), tránh 2 nơi tự viết
 * lại logic ghép query string rồi lệch nhau.
 *
 * Trước 2026-09-28 (mục 23 changelog notification), `link.params` được khai báo trong type nhưng
 * KHÔNG nơi nào đọc tới - cả 2 màn chỉ dùng `module`/`page`. Lộ ra khi `WAREHOUSE_TRANSFER_CREATED`
 * cần trỏ vào đúng sub-tab "Nhập nội bộ" của `NhapKhoPage.tsx` (2 sub-tab khác hẳn chức năng, chọn
 * bằng local state, không có route riêng) - phải thêm 1 tham số ngoài `m`/`p` mới đủ.
 *
 * `focus` (2026-10-08, mục 29.3): `<entityType>:<entityId>` của thông báo - `NotificationFocus` (app/page.tsx)
 * cuộn tới và nháy sáng dòng có `data-focus-id` khớp, để bấm thông báo là thấy đúng mục chứ không chỉ đúng màn.
 */
export function buildNotificationLinkUrl(
  link: NonNullable<NotificationLink>,
  focus?: { entityType?: string | null; entityId?: string | null } | null,
): string {
  const params = new URLSearchParams()
  params.set('m', link.module)
  if (link.page) params.set('p', link.page)
  if (link.params) {
    for (const [key, value] of Object.entries(link.params)) {
      if (value != null) params.set(key, String(value))
    }
  }
  // `link.params.focus` (BE chỉ định riêng, vd theo mã PI) thắng khoá suy từ entity của thông báo.
  if (!params.has('focus') && focus?.entityType && focus.entityId) params.set('focus', focusKey(focus.entityType, focus.entityId))
  return `/?${params.toString()}`
}

/** Khoá gắn ở dòng danh sách (`data-focus-id`) và ở URL (`focus`) - 2 nơi PHẢI cùng dạng này. */
export function focusKey(entityType: string, entityId: string | number | bigint): string {
  return `${entityType}:${String(entityId)}`
}

/** Thuộc tính rải vào dòng/thẻ để thông báo trỏ tới được: `<tr {...focusAttr('PRODUCTION_INVOICE', pi.id)}>` */
export function focusAttr(entityType: string, entityId: string | number | bigint | null | undefined) {
  return entityId == null ? {} : { 'data-focus-id': focusKey(entityType, entityId) }
}

/** Dòng GOM nhiều đối tượng con (vd dòng PI trong màn KCS chứa nhiều đợt): trả về 1 thuộc tính chứa các khoá
 *  cách nhau bằng khoảng trắng - `NotificationFocus` khớp theo từ (`~=`) nên khoá nào trùng cũng nháy dòng gom đó. */
export function focusAttrAny(keys: ReadonlyArray<string | null | undefined>) {
  const list = keys.filter((k): k is string => !!k)
  return list.length === 0 ? {} : { 'data-focus-id': list.join(' ') }
}

/** Mỗi người dùng chỉ vào 1 phân hệ (xem `resolveDefaultModule`), riêng Giám đốc chọn tự do - khớp đúng
 *  điều kiện `app/page.tsx` dùng để chấp nhận `?m=`. */
export function canOpenModule(user: User | null, module: string): boolean {
  if (!user) return false
  return isDirector(user) || module === resolveDefaultModule(user)
}

/**
 * Chọn đích cho 1 thông báo: link chính nếu người nhận mở được phân hệ đó, không thì link thay thế
 * đầu tiên mở được. null = không có link hoặc không có đích nào người này mở được (vd Mua hàng nhận
 * thông báo kho) - UI nên báo thay vì bấm mà không có gì xảy ra.
 */
export function resolveNotificationUrl(
  n: Pick<Notification, 'link' | 'entityType' | 'entityId'>,
  user: User | null,
): string | null {
  const link = n.link
  if (!link?.module) return null
  const candidates = [link, ...(link.alternatives ?? [])]
  const target = candidates.find((c) => canOpenModule(user, c.module))
  if (!target) return null
  // `focus` chỉ có nghĩa với màn của link CHÍNH hoặc thay thế - entityId vẫn là cùng đối tượng nghiệp vụ.
  return buildNotificationLinkUrl({ ...target }, n)
}

/** true = thông báo CÓ link nhưng người này không có đích nào mở được (để hiện chú thích). */
export function isLinkUnreachable(
  n: Pick<Notification, 'link' | 'entityType' | 'entityId'>,
  user: User | null,
): boolean {
  return !!n.link?.module && resolveNotificationUrl(n, user) === null
}
