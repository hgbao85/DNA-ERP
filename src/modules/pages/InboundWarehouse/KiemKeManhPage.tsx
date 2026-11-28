'use client'

/**
 * Tồn mảnh + kiểm kê mảnh của thủ kho Sơn (28/11/2026 - nghiệp vụ 27/11: ngày kiểm kê, Sơn chỉ đếm mảnh, không đếm thanh phôi).
 * Đọc tồn mảnh của kho mình (GET /stock-quant?warehouseId), mỗi dòng có nút Kiểm kê: nhập SỐ ĐẾM, hệ thống ghi phần chênh đối ứng
 * "Cân đối tồn kho" (POST /stock-ledger/adjust kèm pieceId + tồn lúc mở hộp - lệch thì báo tải lại). Logic tính ở kiemKeManhModel.
 * Chỉ hiện mảnh đã có dòng tồn ở kho (kể cả 0).
 */
import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeStockQuant } from '../../../services/stock-api'
import type { BeWarehouse } from '../../../services/warehouses-api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import Modal from '../../../components/Modal'
import { btnSecondary } from '../../../styles/buttons'
import { errMsg } from '../../../utils/errors'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { butToanKiemKe, docSoDem, dongTonManh, type DongManh } from './kiemKeManhModel'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

export default function KiemKeManhPage({ lockedWarehouseCode }: { lockedWarehouseCode: string }) {
  const { data: warehouses, isLoading: whLoading, error: whError, refetch: refetchWh } = useFetch<BeWarehouse[]>(() => api.getWarehouses(), [])
  const wh = (warehouses ?? []).find(w => w.code === lockedWarehouseCode) ?? null
  const openingId = (warehouses ?? []).find(w => w.code === 'OPENING_BALANCE')?.id ?? null
  const { data: quants, isLoading, error, refetch } = useFetch<BeStockQuant[]>(
    () => (wh ? api.getStockQuants({ warehouseId: wh.id }) : Promise.resolve([])), [wh?.id])
  useRealtimeRefetch(['stock'], refetch)
  const rows = useMemo(() => dongTonManh(quants, wh?.id ?? null), [quants, wh?.id])
  const [kiemKe, setKiemKe] = useState<DongManh | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (whLoading || (wh && isLoading && !quants)) return <LoadingState />
  if (whError || error) return <LoadErrorState error={whError ?? error ?? 'Không rõ nguyên nhân'} onRetry={() => { refetchWh(); refetch() }} />
  if (!wh) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Không tìm thấy kho {lockedWarehouseCode}.</div>

  const tong = rows.reduce((s, r) => s + r.qty, 0)
  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Layers size={20} /> Tồn mảnh
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Mảnh đang tồn tại <b>{wh.name}</b>. Kiểm kê: đếm số mảnh thật, bấm <b>Kiểm kê</b> ở dòng mảnh và nhập số đếm được - hệ thống tự ghi
        phần chênh. Tổng: <b>{fmt(tong)}</b> mảnh.
      </div>
      {notice && (
        <div style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 12.5 }}>
          {notice}
        </div>
      )}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Mã mảnh</th>
              <th style={th}>Tên mảnh</th>
              <th style={thR}>Tồn</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.pieceId} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.pieceCode}</td>
                <td style={td}>{r.pieceName}</td>
                <td style={{ ...tdR, color: r.qty < 0 ? 'var(--fg-b91c1c)' : undefined }}>{fmt(r.qty)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => { setNotice(null); setKiemKe(r) }} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>Kiểm kê</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">Chưa có mảnh nào trong kho</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <KiemKeManhModal
        row={kiemKe}
        warehouseId={wh.id}
        warehouseName={wh.name}
        openingBalanceWarehouseId={openingId}
        onClose={() => setKiemKe(null)}
        onDone={msg => { setKiemKe(null); setNotice(msg); refetch() }}
      />
    </div>
  )
}

function KiemKeManhModal({ row, warehouseId, warehouseName, openingBalanceWarehouseId, onClose, onDone }: {
  row: DongManh | null
  warehouseId: string
  warehouseName: string
  openingBalanceWarehouseId: string | null
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<DongManh | null>(null)
  if (row !== openedFor) {
    // Mở cho dòng khác: đặt lại số (đặt state lúc render thay vì effect).
    setOpenedFor(row)
    setCounted(row ? String(Math.max(0, row.qty)) : '')
    setNote('')
    setErr(null)
  }
  if (!row) return null
  const soDem = docSoDem(counted)
  const valid = soDem !== null && note.trim().length >= 3
  const chenh = soDem !== null ? Math.round((soDem - row.qty) * 1e4) / 1e4 : null

  const submit = async () => {
    if (soDem === null || !valid) return
    const but = openingBalanceWarehouseId
      ? butToanKiemKe({ warehouseId, openingBalanceWarehouseId, pieceId: row.pieceId, tonHeThong: row.qty, soDem, ghiChu: note })
      : undefined
    if (but === null) { onDone(`${row.pieceCode}: số đếm khớp tồn (${fmt(soDem)}), không ghi gì.`); return }
    if (!but) { setErr('Không tìm thấy kho "Cân đối tồn kho" - báo IT'); return }
    setBusy(true)
    setErr(null)
    try {
      const res = await api.adjustStock(but)
      const canhBao = res.reservationWarning ? ` ${res.reservationWarning}` : ''
      onDone(`${row.pieceCode}: đã ghi kiểm kê ${fmt(row.qty)} → ${fmt(soDem)}.${canhBao}`)
    } catch (e) {
      setErr(errMsg(e, 'Không ghi được kiểm kê'))
    } finally {
      setBusy(false)
    }
  }

  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={420} zIndex={2000}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Kiểm kê mảnh</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        {row.pieceCode} {row.pieceName} · {warehouseName}<br />
        Tồn hệ thống <b>{fmt(row.qty)}</b>.
      </p>
      <label style={{ fontSize: 12, fontWeight: 600 }}>Số đếm được (mảnh)</label>
      <input value={counted} onChange={e => setCounted(e.target.value)} inputMode="numeric" autoFocus aria-label={`Số mảnh đếm được ${row.pieceCode}`} style={{ ...input, margin: '4px 0 10px' }} />
      <label style={{ fontSize: 12, fontWeight: 600 }}>Ghi chú (bắt buộc)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="vd Kiểm kê ngày xưởng nghỉ" style={{ ...input, marginTop: 4, resize: 'vertical' }} />
      {counted.trim() !== '' && soDem === null && <div style={{ marginTop: 8, color: 'var(--fg-c62828)', fontSize: 12.5 }}>Số đếm phải là số nguyên từ 0 trở lên</div>}
      {chenh !== null && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          Chênh: <b style={{ color: chenh < 0 ? 'var(--fg-b91c1c)' : chenh > 0 ? 'var(--fg-15803d)' : 'var(--text3)' }}>{chenh > 0 ? '+' : ''}{fmt(chenh)}</b>
        </div>
      )}
      {err && <div style={{ marginTop: 10, color: 'var(--fg-c62828)', fontSize: 12.5 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={btnSecondary}>Hủy</button>
        <button onClick={submit} disabled={!valid || busy}
          style={{ ...btnSecondary, background: 'var(--bg-2e7d32)', color: '#fff', borderColor: 'var(--bg-2e7d32)', opacity: !valid || busy ? 0.6 : 1 }}>
          {busy ? 'Đang ghi...' : 'Ghi kiểm kê'}
        </button>
      </div>
    </Modal>
  )
}
