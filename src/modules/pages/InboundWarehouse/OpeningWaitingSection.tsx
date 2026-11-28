'use client'

/**
 * Đầu kỳ ngày bật giao nhận (câu 2, chốt 28/11/2026 cách 1) - phần của thủ kho Hàn (xưởng có kho Sơn), hiện trên tab "Giao khung cho
 * Sơn". Khung đã Hàn đạt KCS trước ngày bật mà đang chờ ở tổ Sơn không có phiếu giao nào: thủ kho đếm thật rồi nhập số theo từng SKU,
 * mảnh - Sơn coi như đã nhận số đó, khung vào tồn kho Sơn. Mỗi dòng nhập 1 lần. Gợi ý = Hàn đạt KCS − Sơn đã báo.
 */
import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import {
  createOpeningWaiting, getOpeningWaitingPlan, type OpeningWaitingRow,
} from '../../../services/stage-handover-api'
import { errMsg } from '../../../utils/errors'
import { openingRowKey, openingWaitingError, parseOpeningQty } from './openingWaitingModel'

const th: React.CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }
const btn: React.CSSProperties = { padding: '4px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }
const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function OpeningWaitingSection() {
  const { data, error, refetch } = useFetch(() => getOpeningWaitingPlan())
  const [open, setOpen] = useState(true)
  if (error || !data?.enabled || !data.applicable || data.rows.length === 0) return null
  const pending = data.rows.filter((r) => r.openingWaitingQty == null).length
  return (
    <div style={card}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'var(--surface2)', border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none', cursor: 'pointer', color: 'var(--text)' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Đầu kỳ: khung Hàn đạt đang chờ ở tổ Sơn {pending > 0 ? `(còn ${pending} dòng chưa nhập)` : '(đã nhập hết)'}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          Ngày bật giao nhận: đếm số khung đã Hàn đạt nhưng chưa sơn đang nằm ở tổ Sơn, nhập theo từng SKU, mảnh. Sơn coi như đã nhận số này, khung vào tồn kho Sơn. Mỗi dòng nhập 1 lần.
        </div>
      </button>
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th}>Lệnh</th><th style={th}>SKU</th><th style={th}>Mảnh</th>
                <th style={thR}>Hàn đạt KCS</th><th style={thR}>Sơn đã báo</th><th style={thR}>Gợi ý</th><th style={thR}>Đếm được</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => <Row key={openingRowKey(r)} r={r} onSaved={refetch} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ r, onSaved }: { r: OpeningWaitingRow; onSaved: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const done = r.openingWaitingQty != null
  const bad = openingWaitingError(text)
  const save = async () => {
    const qty = parseOpeningQty(text)
    if (qty == null) return
    if (!window.confirm(`Nhập ${fmt(qty)} ${r.pieceName} (SKU ${r.sku}) đang chờ Sơn? Mỗi dòng chỉ nhập được 1 lần.`)) return
    setBusy(true); setErr(null)
    try { await createOpeningWaiting({ productionOrderId: r.productionOrderId, pieceId: r.pieceId, qty }); onSaved() }
    catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ ...td, fontFamily: 'monospace' }}>{r.lenhCode}</td>
      <td style={td}>{r.sku}</td>
      <td style={td}>{r.pieceName}</td>
      <td style={tdR}>{fmt(r.hanPassedQty)}</td>
      <td style={tdR}>{fmt(r.sonReportedQty)}</td>
      <td style={{ ...tdR, color: 'var(--text2)' }}>{fmt(r.suggestedQty)}</td>
      <td style={tdR}>
        {done ? <b>{fmt(r.openingWaitingQty ?? 0)}</b> : (
          <input aria-label={`Số khung chờ Sơn ${r.sku} ${r.pieceName}`} inputMode="numeric" value={text} placeholder={String(r.suggestedQty)}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
            style={{ width: 80, padding: '4px 8px', border: `1px solid ${text && bad ? 'var(--fg-dc2626)' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
        )}
        {err && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'left', marginTop: 4, maxWidth: 260 }}>{err}</div>}
      </td>
      <td style={td}>
        {done ? <span style={{ fontSize: 12, color: 'var(--green)' }}>Đã nhập</span> : (
          <button type="button" style={btn} disabled={busy || !!bad} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        )}
      </td>
    </tr>
  )
}
