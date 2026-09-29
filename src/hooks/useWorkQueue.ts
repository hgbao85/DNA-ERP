'use client'

/**
 * State dùng chung cho badge "việc chờ tôi" trên menu (changelog notification 2026-09-25 mục 6.3,
 * Phase 4 - xem mục 27). Mirror ĐÚNG useNotifications.ts (poll định kỳ, dừng khi tab ẩn
 * `visibilitychange`, refetch ngay khi quay lại tab) - khác ở chỗ không có list/toast/mark-read,
 * chỉ 1 map đếm phẳng vì BE (`GET /me/work-queue`) đã tự lọc đúng role người gọi, không cần lọc gì
 * thêm ở FE.
 *
 * ĐÂY LÀ HÀM STATE THÔ - gọi trực tiếp sẽ tạo 1 bộ poll RIÊNG cho mỗi lần gọi. Dùng
 * `useWorkQueue()` từ `context/WorkQueueContext.tsx` (1 Provider dùng chung cho cả cây, cùng lý do
 * double-poll đã sửa cho NotificationsContext) thay vì gọi thẳng hàm này.
 */
import { useCallback, useEffect, useState } from 'react'
import { getWorkQueue } from '../services/api'

const POLL_INTERVAL_MS = 30_000

export function useWorkQueueState() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const poll = useCallback(async () => {
    try {
      const next = await getWorkQueue()
      setCounts(next.counts)
    } catch {
      // Best-effort - lỗi mạng lúc poll không được làm hỏng phần còn lại của app.
    }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(() => { if (!document.hidden) poll() }, POLL_INTERVAL_MS)
    const onVisibility = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll])

  return { counts }
}

export type WorkQueueState = ReturnType<typeof useWorkQueueState>
