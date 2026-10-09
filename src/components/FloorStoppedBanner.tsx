'use client'

import { useCallback, useEffect, useState } from 'react'
import { PauseCircle } from 'lucide-react'
import { http } from '../services/core/http'
import { useRealtimeRefetch } from '../realtime/hooks'

interface OrderRow {
  productionInvoiceId: string
  piCode: string
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED'
  status: string
}

/**
 * Báo cho tổ xưởng/thủ kho biết PI nào đang bị QLSX TẠM DỪNG (P1 mục 31 changelog notification). Màn xưởng chỉ liệt kê PI
 * có ít nhất 1 SKU `floorStage = ACTIVE` nên PI bị tạm dừng chỉ BIẾN MẤT khỏi danh sách - người làm không biết vì sao.
 * "Tạm dừng" theo PI = có SKU PAUSED và KHÔNG còn SKU nào ACTIVE (cùng quy tắc gộp theo PI của listProductionOrdersForStage).
 * Tự làm mới theo realtime `production-orders` (không có ô nhập nào bị ảnh hưởng nên không cần banner "Tải lại").
 * PI đã KẾT THÚC không liệt kê (lịch sử dài, đã có thông báo riêng).
 */
export default function FloorStoppedBanner() {
  const [paused, setPaused] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const res = await http.get<OrderRow[] | { data: OrderRow[] }>('/production-orders?limit=100')
      const list = Array.isArray(res) ? res : res.data
      const live = list.filter((o) => o.status === 'RELEASED' || o.status === 'IN_PROGRESS')
      const activePi = new Set(live.filter((o) => o.floorStage === 'ACTIVE').map((o) => o.productionInvoiceId))
      const codes = new Map<string, string>()
      for (const o of live) {
        if (o.floorStage === 'PAUSED' && !activePi.has(o.productionInvoiceId)) codes.set(o.productionInvoiceId, o.piCode)
      }
      setPaused([...codes.values()].sort())
    } catch {
      // Best-effort: banner chỉ là gợi ý, lỗi mạng thì không hiện.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useRealtimeRefetch(['production-orders'], () => {
    void load()
  })

  if (paused.length === 0) return null
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 14,
        borderRadius: 8, border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', fontSize: 13,
      }}
    >
      <PauseCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        <b>Lệnh đang TẠM DỪNG — chưa thao tác được:</b> {paused.join(', ')}. Các PI này ẩn khỏi danh sách cho tới khi QLSX bấm
        &quot;Tiếp tục&quot;.
      </span>
    </div>
  )
}
