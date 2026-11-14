'use client'

/**
 * Tab "Chia máy cắt" của màn QLSX "Sản lượng xưởng": bảng chia sắt cho từng máy cắt của xưởng.
 * Hệ thống tự chia (BE `/floor/cut-allocation`), QLSX xưởng chỉnh tay: đổi máy, sửa số cây, tách, xoá, đổi thứ tự cắt.
 * Chỉ là bảng kế hoạch, không đổi luồng quét QR hay hàng đợi tổ. Mọi route trả cả bảng nên sau mỗi thao tác thay thẳng bảng.
 */

import { useState } from 'react'
import { getWorkshops } from '../../../services/workshops-api'
import type { Workshop } from '../../../types/workshop'
import { useScopedWorkshop } from '../../../hooks/useScopedWorkshop'
import { useFetch } from '../../../hooks/useFetch'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { emptyBox, input, Pill, rowWrap, sectionTitle, stack } from './qlsxUi'
import { workshopLabel as fmtWorkshopName } from './cutAllocationModel'
import Board from './cutAllocation/Board'

const WORKSHOP_KEY = 'qlsx.cutAllocation.workshop'

function readRemembered(): string {
  try { return localStorage.getItem(WORKSHOP_KEY) ?? '' } catch { return '' }
}

/** Ô chọn xưởng; người gắn xưởng chỉ thấy tên xưởng. */
function WorkshopSelect({ scopedName, scoped, value, list, onChoose }: {
  scopedName: string | null; scoped: boolean; value: string; list: Workshop[]; onChoose: (id: string) => void
}) {
  if (scoped) return <Pill tone="blue">{fmtWorkshopName(scopedName)}</Pill>
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>Xưởng</span>
      <select style={input} value={value} onChange={(e) => onChoose(e.target.value)} aria-label="Chọn xưởng">
        <option value="">- Chọn xưởng -</option>
        {list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  )
}

export default function QlsxCutAllocation() {
  const { scopedWorkshopId, scopedWorkshopName } = useScopedWorkshop()
  const shops = useFetch<Workshop[]>(() => (scopedWorkshopId ? Promise.resolve([]) : getWorkshops()), [scopedWorkshopId])
  const [picked, setPicked] = useState<string>(readRemembered)
  const list = shops.data ?? []
  const choose = (id: string) => {
    setPicked(id)
    try { localStorage.setItem(WORKSHOP_KEY, id) } catch { /* bỏ qua */ }
  }

  // Xưởng đã nhớ mà không còn trong danh sách -> coi như chưa chọn.
  const effective = scopedWorkshopId ?? (list.some((w) => w.id === picked) ? picked : '')
  const label = scopedWorkshopId ? (scopedWorkshopName ?? '') : (list.find((w) => w.id === effective)?.name ?? '')
  const listing = !scopedWorkshopId

  return (
    <section style={stack(12)} aria-label="Chia máy cắt">
      <div style={{ ...rowWrap, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={sectionTitle}>Chia máy cắt</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Bảng kế hoạch cắt của từng máy. Hệ thống chia sẵn, bấm “Sửa” ở thẻ máy khi cần chỉnh.
          </div>
        </div>
        <WorkshopSelect scoped={!listing} scopedName={scopedWorkshopName} value={effective} list={list} onChoose={choose} />
      </div>
      {listing && shops.isLoading ? <LoadingState /> : listing && shops.error ? (
        <LoadErrorState error={shops.error} onRetry={() => void shops.refetch()} />
      ) : effective === '' ? (
        <div style={emptyBox}>Chọn xưởng để xem bảng chia máy cắt.</div>
      ) : (
        <Board key={effective} workshopId={effective} workshopLabel={label} />
      )}
    </section>
  )
}
