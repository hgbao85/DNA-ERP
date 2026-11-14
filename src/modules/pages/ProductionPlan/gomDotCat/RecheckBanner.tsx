'use client'

/** Khung "Lệnh vừa đổi xưởng - cần kiểm lại phương án cắt": mỗi lệnh 1-2 dòng, nút Đã kiểm luôn nằm bên phải. */

import { useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { confirmCuttingRecheck, type CuttingRecheckItem } from '../../../../services/production-invoices-api'
import { errMsg } from '../../../../utils/errors'
import type { useConfirm } from '../../../../hooks/useConfirm'

type Ask = ReturnType<typeof useConfirm>['ask']

const box: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px', background: 'var(--bg-fef3c7)', border: '1px solid var(--fg-b45309)',
  borderRadius: 'var(--radius)',
}
const titleRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, color: 'var(--fg-b45309)',
}
const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const doneBtn = (isMobile: boolean, busy: boolean): React.CSSProperties => ({
  flexShrink: 0, padding: '5px 12px', minHeight: isMobile ? 36 : undefined, background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
})

const changedAt = (iso: string) => format(new Date(iso), 'dd/MM HH:mm')

function RecheckRow({ item, isMobile, busy, error, onConfirm }: {
  item: CuttingRecheckItem; isMobile: boolean; busy: boolean; error: string | null; onConfirm: () => void
}) {
  const ws = item.workshopName ?? 'chưa rõ xưởng'
  return (
    <div>
      {/* Mỗi lệnh gọn 1-2 dòng (mã + xưởng mới + giờ). Điện thoại: giờ xuống dòng thứ hai. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={ellipsis} title={`${item.displayCode} — xưởng mới: ${ws}`}>
            <b style={{ fontSize: 13 }}>{item.displayCode}</b>
            <span style={{ marginLeft: 8 }}>Xưởng mới: <b>{ws}</b></span>
            {!isMobile && <span style={{ marginLeft: 8, color: 'var(--text2)' }}>· Đổi lúc {changedAt(item.requiredAt)}</span>}
          </div>
          {isMobile && <div style={{ color: 'var(--text2)', fontSize: 12 }}>Đổi lúc {changedAt(item.requiredAt)}</div>}
        </div>
        <button disabled={busy} onClick={onConfirm} style={doneBtn(isMobile, busy)}>
          {busy ? 'Đang lưu…' : 'Đã kiểm'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--fg-b91c1c)', fontSize: 12, marginTop: 2 }}>{error}</div>}
    </div>
  )
}

export default function RecheckBanner({ items, isMobile, ask, onChanged }: {
  items: CuttingRecheckItem[]; isMobile: boolean; ask: Ask; onChanged?: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<{ id: string; msg: string } | null>(null)
  if (items.length === 0) return null

  const confirmItem = (r: CuttingRecheckItem) => {
    const ws = r.workshopName ?? 'chưa rõ xưởng'
    ask(
      {
        title: 'Đã kiểm phương án cắt',
        message: `Xác nhận đã kiểm phương án cắt của lệnh ${r.displayCode} cho ${ws}? `
          + 'Sau khi bấm, Sếp duyệt được lệnh này (lệnh đã duyệt thì kho được chuyển sắt và xuất sắt).',
        confirmLabel: 'Đã kiểm',
      },
      async () => {
        setBusyId(r.productionInvoiceId)
        setErr(null)
        try {
          await confirmCuttingRecheck(r.productionInvoiceId)
        } catch (e) {
          setErr({ id: r.productionInvoiceId, msg: errMsg(e, 'Không lưu được, thử lại sau') })
        } finally {
          setBusyId(null)
          onChanged?.()
        }
      },
    )
  }

  return (
    <div style={box}>
      <div style={titleRow}>
        <AlertTriangle size={16} /> Lệnh vừa đổi xưởng – cần kiểm lại phương án cắt ({items.length})
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
        Xưởng mới có thể có luật cắt riêng (vd Phước An tối đa 2 cỡ đoạn/cây). Kiểm tra, cần thì tính lại cho xưởng mới
        rồi bấm Đã kiểm — Sếp chưa duyệt được lệnh tới khi đó.
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((r) => (
          <RecheckRow key={r.productionInvoiceId} item={r} isMobile={isMobile} busy={busyId === r.productionInvoiceId}
            error={err?.id === r.productionInvoiceId ? err.msg : null} onConfirm={() => confirmItem(r)} />
        ))}
      </div>
    </div>
  )
}
