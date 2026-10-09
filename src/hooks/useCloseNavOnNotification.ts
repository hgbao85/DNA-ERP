'use client'

import { useEffect } from 'react'

/** Sự kiện NotificationCenter/MyNotificationsPage phát ngay trước khi điều hướng theo thông báo. */
export const NOTIFICATION_NAVIGATE_EVENT = 'dna:notification-navigate'

export function emitNotificationNavigate(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATION_NAVIGATE_EVENT))
}

/**
 * Đóng ngăn menu bên (bố cục hẹp) khi người dùng bấm 1 thông báo để sang màn khác - nếu không ngăn menu
 * vẫn mở che mất dòng được nháy sáng (live-test 08/10/2026, mục 30.7). Mỗi app shell có state `drawerOpen`
 * riêng nên dùng sự kiện chung thay vì truyền callback xuyên 7 app.
 */
export function useCloseNavOnNotification(close: () => void): void {
  useEffect(() => {
    window.addEventListener(NOTIFICATION_NAVIGATE_EVENT, close)
    return () => window.removeEventListener(NOTIFICATION_NAVIGATE_EVENT, close)
  }, [close])
}
