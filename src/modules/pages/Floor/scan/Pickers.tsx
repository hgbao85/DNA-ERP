'use client'

/** Chọn lệnh sản xuất và chọn sản phẩm (SKU) trên màn quét. Chữ cho công nhân: "Lệnh", không viết tắt. */

import type { ReactNode } from 'react'
import { useLenhCodeLookup } from '../../../../components/LenhCode'
import type { BeScanContext, BeScanOrder } from '../../../../services/floor-api'
import { missingPiecesText, pickablePis } from './scanModel'
import { deadlineInfo, DEADLINE_COLOR } from '../stageOutputModel'
import { chipRow, hint, label, pickChip } from './scanUi'

function PickChip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} style={pickChip(on)} onClick={onClick} title={title}>
      {on && <span aria-hidden style={{ fontSize: 18, fontWeight: 800 }}>✓</span>}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>{children}</span>
    </button>
  )
}

/** Dòng nhỏ hạn giao trong ô lệnh: cam khi sắp tới hạn, đỏ + "quá hạn" khi trễ; ô đang chọn (nền đặc) giữ chữ trắng. */
function DeadlineLine({ deadline, on }: { deadline?: string | null; on: boolean }) {
  const dl = deadlineInfo(deadline)
  if (!dl) return null
  return (
    <span style={{ fontSize: 12, fontWeight: dl.tone === 'normal' ? 400 : 700, color: on ? '#fff' : DEADLINE_COLOR[dl.tone] }}>
      hạn {dl.date}{dl.tone === 'late' ? ' · quá hạn' : ''}
    </span>
  )
}

/**
 * Chọn lệnh (23/11/2026, bỏ hàng đợi). Hàn / Sơn: chip "mã lệnh · còn thiếu N mảnh" (BE đã sắp hạn giao tăng dần);
 * Phôi: lệnh trong bảng chia. Không có nhãn "đang làm" / "làm bù".
 */
export function PiPicker({ ctx, selectedPi, onSelect }: {
  ctx: BeScanContext; selectedPi: string | null; onSelect: (id: string) => void
}) {
  const list = pickablePis(ctx)
  const lenhOf = useLenhCodeLookup(list.map((a) => a.code))
  if (list.length === 0) return null
  const byStage = (ctx.stagePis ?? []).length > 0
  return (
    <div>
      <div style={label}>{byStage ? 'Lệnh sản xuất' : 'Lệnh trong bảng chia'}</div>
      <div style={chipRow}>
        {list.map((a) => (
          <PickChip key={a.productionInvoiceId} on={selectedPi === a.productionInvoiceId} onClick={() => onSelect(a.productionInvoiceId)}>
            <span>{lenhOf(a.code)}{a.missingPieces != null && <> · {missingPiecesText(a.missingPieces)}</>}</span>
            <DeadlineLine deadline={a.deadline} on={selectedPi === a.productionInvoiceId} />
          </PickChip>
        ))}
      </div>
    </div>
  )
}

const strong: React.CSSProperties = { color: 'var(--text)' }

export function SkuPicker({ orders, value, onChange }: {
  orders: BeScanOrder[]; value: string | null; onChange: (id: string) => void
}) {
  if (orders.length <= 1) {
    const o = orders[0]
    if (!o) return null
    return (
      <div style={hint}>
        Sản phẩm <b style={strong}>{o.productName}</b> ({o.sku}) · {o.quantity} cái
      </div>
    )
  }
  return (
    <div>
      <div style={label}>Sản phẩm</div>
      <div style={chipRow}>
        {orders.map((o) => (
          <PickChip key={o.productionOrderId} on={value === o.productionOrderId} title={o.sku}
            onClick={() => onChange(o.productionOrderId)}>
            {o.productName} · {o.quantity} cái
          </PickChip>
        ))}
      </div>
    </div>
  )
}
