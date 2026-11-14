'use client'

/**
 * Chọn xưởng cho hàng đợi tổ (14/11/2026, đợt C1): hàng đợi theo xưởng. QLSX gắn xưởng thì cố định xưởng mình (BE đã lọc);
 * KHSX / Sếp / Admin chọn xưởng, nhớ lựa chọn trong phiên (cùng cách chọn xưởng của tab "Chia máy cắt").
 */

import { useState } from 'react'
import { getWorkshops } from '../../../services/workshops-api'
import type { Workshop } from '../../../types/workshop'
import { useScopedWorkshop } from '../../../hooks/useScopedWorkshop'
import { useFetch } from '../../../hooks/useFetch'
import { workshopLabel } from './cutAllocationModel'
import { input, Pill } from './qlsxUi'

const QUEUE_WORKSHOP_KEY = 'qlsx.queue.workshop'

export interface QueueWorkshop {
  /** Xưởng đang xem: xưởng của người dùng, hoặc xưởng đã chọn; rỗng khi chưa có xưởng nào để chọn. */
  workshopId: string | null
  /** true = người dùng gắn xưởng (không đổi được). */
  scoped: boolean
  scopedName: string | null
  list: Workshop[]
  isLoading: boolean
  error: string | null
  retry: () => void
  choose: (id: string) => void
}

/** Xưởng đã nhớ mà không còn trong danh sách -> lấy xưởng đầu danh sách. */
export function pickEffectiveWorkshop(list: Pick<Workshop, 'id'>[], remembered: string): string | null {
  if (list.some((w) => w.id === remembered)) return remembered
  return list[0]?.id ?? null
}

export function useQueueWorkshop(): QueueWorkshop {
  const { scopedWorkshopId, scopedWorkshopName } = useScopedWorkshop()
  const shops = useFetch<Workshop[]>(() => (scopedWorkshopId ? Promise.resolve([]) : getWorkshops()), [scopedWorkshopId])
  const [picked, setPicked] = useState<string>(() => {
    try { return sessionStorage.getItem(QUEUE_WORKSHOP_KEY) ?? '' } catch { return '' }
  })
  const list = shops.data ?? []
  const choose = (id: string) => {
    setPicked(id)
    try { sessionStorage.setItem(QUEUE_WORKSHOP_KEY, id) } catch { /* bỏ qua */ }
  }
  return {
    workshopId: scopedWorkshopId ?? pickEffectiveWorkshop(list, picked),
    scoped: !!scopedWorkshopId,
    scopedName: scopedWorkshopName,
    list,
    isLoading: !scopedWorkshopId && shops.isLoading,
    error: scopedWorkshopId ? null : shops.error,
    retry: () => { void shops.refetch() },
    choose,
  }
}

/** Ô chọn xưởng ở đầu khối hàng đợi; người gắn xưởng chỉ thấy tên xưởng. */
export function QueueWorkshopPicker({ ws }: { ws: QueueWorkshop }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Xưởng</span>
      {ws.scoped ? (
        <Pill tone="blue">{workshopLabel(ws.scopedName)}</Pill>
      ) : (
        <select style={{ ...input, minWidth: 0, flex: '0 1 240px' }} value={ws.workshopId ?? ''} onChange={(e) => ws.choose(e.target.value)} aria-label="Chọn xưởng">
          {ws.list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
    </div>
  )
}
