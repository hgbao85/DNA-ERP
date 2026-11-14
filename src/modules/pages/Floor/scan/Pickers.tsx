'use client'

/** Chọn lệnh sản xuất và chọn sản phẩm (SKU) trên màn quét. Chữ cho công nhân: "Lệnh", "làm bù", không viết tắt. */

import type { ReactNode } from 'react'
import LenhCode, { useLenhCodeLookup } from '../../../../components/LenhCode'
import type { BeScanContext, BeScanOrder } from '../../../../services/floor-api'
import { allocationOnlyPis } from './scanModel'
import { chip, chipRow, hint, label } from './scanUi'

function PickChip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} style={chip(on)} onClick={onClick} title={title}>{children}</button>
  )
}

export function PiPicker({ ctx, selectedPi, onSelect }: {
  ctx: BeScanContext; selectedPi: string | null; onSelect: (id: string) => void
}) {
  const running = ctx.runningPi
  const rework = ctx.reworkPis ?? []
  const allocation = allocationOnlyPis(ctx)
  const lenhOf = useLenhCodeLookup(allocation.map((a) => a.code))
  if (!running && rework.length === 0 && allocation.length === 0) return null
  const hasQueuePi = !!running || rework.length > 0
  return (
    <div>
      {hasQueuePi && (
        <>
          <div style={label}>Lệnh sản xuất</div>
          <div style={chipRow}>
            {running && (
              <PickChip on={selectedPi === running.productionInvoiceId} onClick={() => onSelect(running.productionInvoiceId)}>
                <LenhCode piCode={running.code} /> · đang làm
              </PickChip>
            )}
            {rework.map((r) => (
              <PickChip key={r.productionInvoiceId} on={selectedPi === r.productionInvoiceId}
                onClick={() => onSelect(r.productionInvoiceId)}>
                <LenhCode piCode={r.code} /> · làm bù
              </PickChip>
            ))}
          </div>
        </>
      )}
      {allocation.length > 0 && (
        <>
          <div style={{ ...label, marginTop: hasQueuePi ? 12 : 0 }}>Lệnh trong bảng chia</div>
          <div style={chipRow}>
            {allocation.map((a) => (
              <PickChip key={a.productionInvoiceId} on={selectedPi === a.productionInvoiceId}
                onClick={() => onSelect(a.productionInvoiceId)}>
                {lenhOf(a.code)}
              </PickChip>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const strong: React.CSSProperties = { color: 'var(--text)' }

/**
 * `piCode` có giá trị khi tổ chỉ có đúng 1 lệnh (đang chạy, không làm bù): khỏi chiếm 1 hàng nhãn + chip chọn lệnh, mã lệnh
 * ghép vào dòng này (điện thoại nhỏ: ô nhập số phải nằm trên nếp gập).
 */
export function SkuPicker({ orders, value, onChange, piCode }: {
  orders: BeScanOrder[]; value: string | null; onChange: (id: string) => void; piCode?: string
}) {
  const piText = piCode ? <>Lệnh <b style={strong}><LenhCode piCode={piCode} /></b></> : null
  if (orders.length <= 1) {
    const o = orders[0]
    if (!o) return piText ? <div style={hint}>{piText}</div> : null
    return (
      <div style={hint}>
        {piText}{piText ? ' · ' : ''}Sản phẩm <b style={strong}>{o.productName}</b> ({o.sku}) · {o.quantity} cái
      </div>
    )
  }
  return (
    <div>
      {piText && <div style={{ ...hint, marginBottom: 8 }}>{piText}</div>}
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
