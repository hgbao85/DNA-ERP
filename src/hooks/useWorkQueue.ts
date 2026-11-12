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
import { useCallback, useEffect, useRef, useState } from 'react'
import { getWorkQueue } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useRealtimeRefetch, useRealtimeStatus } from '../realtime/hooks'

/**
 * Topic nghiệp vụ làm thay đổi số việc chờ (xem WorkQueueService ở BE) - rà lại từng counter
 * 2026-10-07, danh sách cũ thiếu quá nửa:
 *   - bossSkuApproval/khsxSkuReview/specSteelQuota/specDetailQuota đọc PlanForm(+Review), ghi
 *     qua skus.controller.ts (@RealtimeEntityOn('SKU')) -> topic 'skus'.
 *   - bossProductionApproval/khsxProductionRejected/qlsxProductionQueue đọc
 *     ProductionInvoiceItem.prodApprovalStatus, ghi qua production-invoices.service.ts -> topic
 *     'production-invoices'. qlsxProductionQueue còn cộng thêm countNeedsAction() (CuttingProposal
 *     DRAFT/FAILED cần duyệt tay) -> topic 'cutting-proposals'.
 *   - salesReadyToShip (SalesOrdersService.countReadyToShip, xem doc comment "Hoàn thành = đóng
 *     gói đủ VÀ QLSX bấm Kết thúc") phụ thuộc CẢ 3: 'sales-orders' (shippedQty), 'packaging-issues'
 *     (đóng gói đủ), 'production-orders' (QLSX bấm Kết thúc).
 * Thiếu topic nào không làm badge SAI (poll định kỳ vẫn bắt kịp), chỉ chậm tới khi poll tiếp -
 * cùng loại lỗi với bug refetchPis() ở ThongKePagePlan.tsx (tín hiệu tới nhưng không đủ để biết
 * cần tải lại CÁI GÌ).
 */
const WORK_QUEUE_TOPICS = [
  'warehouse-transfers',
  'purchase-proposals',
  'steel-issues',
  'production-batches',
  'qc-reviews',
  'stock',
  'skus',
  'production-invoices',
  'cutting-proposals',
  'sales-orders',
  'packaging-issues',
  'production-orders',
] as const

const POLL_INTERVAL_MS = 30_000
// Đang kết nối realtime thì badge được đẩy về ngay khi việc đổi - polling chỉ còn là lưới an toàn.
const POLL_INTERVAL_CONNECTED_MS = 120_000
// Vừa poll xong với CÙNG token trong ngưỡng này thì effect không poll tức thì lần nữa (xem lastPollRef).
const RECENT_POLL_WINDOW_MS = 2_000

export function useWorkQueueState() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const connected = useRealtimeStatus() === 'connected'
  // Chưa đăng nhập thì không gọi API (tránh 401 vô ích lúc mount trên /login).
  const { token } = useAuth()
  // Mở app: poll lần 1 ngay khi có token, vài ms sau realtime sang 'connected' làm effect chạy lại → poll lần 2 thừa.
  // Ghi mốc lần poll gần nhất để effect bỏ qua poll tức thì đó. Chỉ chặn trong effect: realtime/refresh/interval/visibility
  // báo thay đổi thật nên vẫn gọi poll bình thường.
  const lastPollRef = useRef<{ token: string; at: number } | null>(null)

  const poll = useCallback(async () => {
    if (!token) return
    lastPollRef.current = { token, at: Date.now() }
    try {
      const next = await getWorkQueue()
      setCounts(next.counts)
    } catch {
      // Best-effort - lỗi mạng lúc poll không được làm hỏng phần còn lại của app.
    }
    // Phần A – Đợt 4 (2026-11-05): PHẢI phụ thuộc `token`. Trước đây deps `[]` giữ `token = null` của lần vẽ đầu (token khôi phục
    // bất đồng bộ / đăng nhập sau) nên poll luôn return sớm - số nhắc việc trên menu không bao giờ hiện, ở mọi phân hệ.
  }, [token])

  useRealtimeRefetch(WORK_QUEUE_TOPICS, poll)

  useEffect(() => {
    if (!token) return
    // Đổi token luôn poll ngay; kết nối lại sau khi rớt lâu hơn ngưỡng cũng poll ngay như cũ.
    const last = lastPollRef.current
    if (!last || last.token !== token || Date.now() - last.at >= RECENT_POLL_WINDOW_MS) poll()
    const id = setInterval(() => { if (!document.hidden) poll() }, connected ? POLL_INTERVAL_CONNECTED_MS : POLL_INTERVAL_MS)
    const onVisibility = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll, connected, token])

  // Phần A – Đợt 9: `refresh` để màn vừa xử lý việc (vd Sếp duyệt đổi mốc) tải lại số nhắc việc ngay, không chờ lượt poll 30–120 s.
  return { counts, refresh: poll }
}

export type WorkQueueState = ReturnType<typeof useWorkQueueState>
