'use client'

/**
 * State + hành vi dùng chung cho NotificationCenter (chuông thông báo toàn cục, xem changelog
 * notification 2026-09-25 mục 6.1). Tách khỏi component để component chỉ lo hiển thị.
 *
 * - Badge: poll GET /notifications/unread-count mỗi 30s, dừng khi tab ẩn (visibilitychange) - đỡ
 *   tốn request cho tab người dùng bỏ không dùng, resume + refetch ngay khi quay lại tab.
 * - Toast: chỉ khi unread TĂNG so với lần poll trước mới tải thêm vài dòng mới nhất (status=unread,
 *   limit=5) để lấy tiêu đề/mức độ - tránh phải tải danh sách mỗi 30s chỉ để biết có gì mới.
 *   Chỉ toast cho severity WARNING/CRITICAL (mục 6.1: "không toast cho INFO").
 * - Danh sách: chỉ tải khi panel MỞ (không tải ngầm khi đóng) - `tab` quyết định lọc
 *   ACTION_REQUIRED-chưa-resolved ("Cần xử lý") hay tất cả.
 *
 * ĐÂY LÀ HÀM STATE THÔ - gọi trực tiếp sẽ tạo 1 bộ poll/state RIÊNG cho mỗi lần gọi. Component
 * dùng `useNotifications()` từ `context/NotificationsContext.tsx` (1 Provider dùng chung cho cả
 * cây) thay vì gọi thẳng hàm này - xem doc comment ở đó lý do (2026-09-25, sửa double-poll: chuông
 * top bar + chuông chân sidebar có lúc cùng mount 1 lúc trên màn hẹp khi drawer đang mở).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, archiveNotification,
} from '../services/api'
import type { Notification } from '../types/admin'

const POLL_INTERVAL_MS = 30_000

export type NotificationTab = 'action' | 'all'

export function useNotificationsState() {
  const [unread, setUnread] = useState<{ total: number; byCategory: Record<string, number> }>({ total: 0, byCategory: {} })
  const [items, setItems] = useState<Notification[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [tab, setTab] = useState<NotificationTab>('action')
  const [toast, setToast] = useState<Notification | null>(null)
  const prevTotalRef = useRef(0)
  const toastedIdsRef = useRef<Set<string>>(new Set())
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((n: Notification) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(n)
    toastTimerRef.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const pollUnread = useCallback(async () => {
    try {
      const next = await getUnreadCount()
      if (next.total > prevTotalRef.current) {
        // Có gì đó mới - tải vài dòng chưa đọc gần nhất để biết có đáng toast không.
        const res = await getNotifications({ status: 'unread', limit: 5 })
        const worthy = res.data.find(
          n => (n.severity === 'WARNING' || n.severity === 'CRITICAL') && !toastedIdsRef.current.has(n.id),
        )
        if (worthy) {
          toastedIdsRef.current.add(worthy.id)
          showToast(worthy)
        }
      }
      prevTotalRef.current = next.total
      setUnread(next)
    } catch {
      // Best-effort - lỗi mạng lúc poll không được làm hỏng phần còn lại của app.
    }
  }, [showToast])

  useEffect(() => {
    pollUnread()
    const id = setInterval(() => { if (!document.hidden) pollUnread() }, POLL_INTERVAL_MS)
    const onVisibility = () => { if (!document.hidden) pollUnread() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [pollUnread])

  const loadList = useCallback(async (forTab: NotificationTab) => {
    setListLoading(true)
    try {
      // 'action' lọc theo resolved=false (đã xử lý xong hay chưa) - KHÔNG dùng status=unread (đã
      // đọc hay chưa): 1 thông báo cần duyệt đã đọc nhưng CHƯA duyệt xong vẫn phải nằm trong
      // "Cần xử lý" (2026-09-25, phản hồi "số trên chuông biến mất khi nào" - đọc ≠ xử lý xong).
      const res = forTab === 'action'
        ? await getNotifications({ resolved: 'false', category: 'ACTION_REQUIRED', limit: 50 })
        : await getNotifications({ status: 'all', limit: 50 })
      setItems(res.data)
    } finally {
      setListLoading(false)
    }
  }, [])

  const openWithTab = useCallback((forTab: NotificationTab) => {
    setTab(forTab)
    loadList(forTab)
  }, [loadList])

  const switchTab = useCallback((next: NotificationTab) => {
    setTab(next)
    loadList(next)
  }, [loadList])

  const markRead = useCallback(async (id: string) => {
    setItems(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    try {
      await markNotificationRead(id)
    } finally {
      pollUnread()
    }
  }, [pollUnread])

  const markAllRead = useCallback(async () => {
    setItems(list => list.map(n => ({ ...n, isRead: true })))
    try {
      await markAllNotificationsRead()
    } finally {
      pollUnread()
    }
  }, [pollUnread])

  const archive = useCallback(async (id: string) => {
    setItems(list => list.filter(n => n.id !== id))
    try {
      await archiveNotification(id)
    } finally {
      pollUnread()
    }
  }, [pollUnread])

  const dismissToast = useCallback(() => setToast(null), [])

  return { unread, items, listLoading, tab, toast, openWithTab, switchTab, markRead, markAllRead, archive, dismissToast }
}

export type NotificationsState = ReturnType<typeof useNotificationsState>
