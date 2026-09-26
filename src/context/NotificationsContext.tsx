'use client'

/**
 * 1 Provider dùng CHUNG cho cả cây - thay vì để `NotificationCenter.tsx` tự gọi
 * `useNotificationsState()` (poll riêng, state riêng) mỗi lần mount.
 *
 * Lý do cần Provider (2026-09-25, phát hiện lúc live-test màn hẹp): mỗi app shell gắn 2 bản
 * `<NotificationCenter>` - 1 ở top bar thu gọn (luôn hiện), 1 ở chân sidebar desktop (chỉ hiện khi
 * KHÔNG thu gọn). Ở màn hẹp, nếu người dùng mở drawer (☰) rồi không đóng lại mà điều hướng tiếp,
 * CẢ 2 bản cùng tồn tại trong cây 1 lúc - nếu mỗi bản tự poll `unread-count` riêng thì tốn gấp đôi
 * số request (đã thấy trong log BE lúc live-test: nhiều request trùng giờ y hệt). Nâng state lên 1
 * Provider mount 1 lần cho cả cây (`app/layout.tsx`, cùng cấp `AuditLogProvider`) giải quyết dứt
 * điểm: bao nhiêu `<NotificationCenter>` cùng mount cũng chỉ 1 bộ poll/toast duy nhất.
 */
import { createContext, useContext } from 'react'
import { useNotificationsState, type NotificationsState } from '../hooks/useNotifications'

const NotificationsCtx = createContext<NotificationsState | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const state = useNotificationsState()
  return <NotificationsCtx.Provider value={state}>{children}</NotificationsCtx.Provider>
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsCtx)
  if (!ctx) throw new Error('useNotifications phải được sử dụng bên trong NotificationsProvider')
  return ctx
}
