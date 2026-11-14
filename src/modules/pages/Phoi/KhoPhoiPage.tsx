'use client'

/**
 * Kho phôi (Phôi) — READ-ONLY.
 *
 * 13/11/2026 (anh Nhân trả lời 11 câu tồn đoạn): tồn đoạn quản theo MÃ ĐOẠN (cỡ đoạn + bộ công đoạn: trơn / dập / tán…), theo kho
 * Phôi của TỪNG XƯỞNG, và giữ theo LỆNH - đọc GET /segment-stock/balances:
 *  - Tồn = đoạn thật trong kho; Giữ cho lệnh = đoạn đủ công đoạn + KCS đạt của các lệnh đang chạy, chờ Hàn / Sơn dùng;
 *    Dư = tồn - giữ, đoạn cắt vượt chung của xưởng, chia cho lệnh sau.
 *  - Phôi KCS đạt thì đoạn tự vào tồn; Hàn / Sơn báo thì tự trừ phần giữ của lệnh (thủ kho không nhập tay, chỉ chỉnh khi kiểm kê).
 * Trước đây trang đọc /stock-quant và parse nhãn "{mã} @ {n}mm": cỡ có số lẻ (vd 452.5 mm) bị bỏ, dòng ≤ 0 bị ẩn (số âm cũ không
 * lộ ra), cùng cỡ khác công đoạn bị trộn - đã bỏ.
 *
 * 2 tab theo quy ước cutLengthMm = 0 = "đầu mẩu" (SegmentSpec riêng KHSX khai cho mỗi sắt) - xem docs/quy-doi-doan-phoi.md.
 */
import { useMemo, useState } from 'react'
import { Warehouse, Check, Scissors } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSegmentBalance } from '../../../services/segment-stock-api'
import LoadingState from '../../../components/LoadingState'
import Modal from '../../../components/Modal'
import { btnSecondary } from '../../../styles/buttons'
import { errMsg } from '../../../utils/errors'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useRealtimeRefetch } from '../../../realtime/hooks'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' }
// overflowX (không cắt): bảng vừa điện thoại, khung chỉ cuộn nếu nội dung thật sự dài.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

type Tab = 'duyet' | 'thua'

/** Kho ảo đối ứng (Hàn / Sơn dùng đoạn thì đoạn "ra" kho này) - không phải tồn thật. */
const PRODUCTION_WAREHOUSE_CODE = 'PRODUCTION'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const fmtMm = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

function tenDoan(r: BeSegmentBalance): string {
  if (r.cutLengthMm === 0) return `${r.materialCode} — đoạn thừa (đầu mẩu)`
  return `${r.materialCode} — đoạn ${fmtMm(r.cutLengthMm)}mm · ${r.segmentStepsLabel}`
}

/**
 * canStocktake: thủ kho kho Phôi (InboundWarehouseApp, tab "Tồn đoạn") - mỗi dòng có nút Kiểm kê (nhập số đếm, ghi phần chênh).
 * lockedWarehouseCode: chỉ hiện đúng kho của thủ kho (không có ô chọn kho).
 */
export default function KhoPhoiPage({ canStocktake = false, lockedWarehouseCode }: { canStocktake?: boolean; lockedWarehouseCode?: string } = {}) {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('duyet')
  const [pickedCode, setWarehouseCode] = useState<string | null>(null)

  const { data: balances, isLoading, error, refetch } = useFetch<BeSegmentBalance[]>(() => api.getSegmentBalances(), [])
  // Realtime: tồn kho đổi (KCS đạt, Hàn / Sơn báo, chuyển, kiểm kê) -> làm mới ngay.
  useRealtimeRefetch(['stock'], refetch)

  // Các kho Phôi có đoạn (bỏ kho ảo). Mặc định: kho người xem đang được gán, không có thì kho đầu tiên.
  const warehouses = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of balances ?? []) if (b.warehouseCode !== PRODUCTION_WAREHOUSE_CODE) m.set(b.warehouseCode, b.warehouseName)
    return [...m.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [balances])
  const [kiemKe, setKiemKe] = useState<BeSegmentBalance | null>(null)
  const warehouseCode = lockedWarehouseCode ? lockedWarehouseCode : pickedCode && warehouses.some(w => w.code === pickedCode)
    ? pickedCode
    : (warehouses.find(w => w.code === user?.warehouseScope) ?? warehouses[0])?.code ?? null

  const { duyet, thua } = useMemo(() => {
    const rows = (balances ?? []).filter(b =>
      b.warehouseCode === warehouseCode && (b.onHandQty !== 0 || b.heldQty !== 0))
    const byName = (a: BeSegmentBalance, b: BeSegmentBalance) =>
      a.materialCode.localeCompare(b.materialCode) || b.cutLengthMm - a.cutLengthMm || a.segmentSteps.localeCompare(b.segmentSteps)
    return {
      duyet: rows.filter(r => r.cutLengthMm !== 0).sort(byName),
      thua: rows.filter(r => r.cutLengthMm === 0).sort(byName),
    }
  }, [balances, warehouseCode])

  const tongDuyet = useMemo(() => duyet.reduce((s, i) => s + i.onHandQty, 0), [duyet])
  const tongThua = useMemo(() => thua.reduce((s, i) => s + i.onHandQty, 0), [thua])
  const coAm = useMemo(() => [...duyet, ...thua].some(r => r.onHandQty < 0 || r.surplusQty < 0), [duyet, thua])

  const rows = tab === 'duyet' ? duyet : thua

  if (isLoading) return <LoadingState />
  if (error || !balances) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const whName = warehouses.find(w => w.code === warehouseCode)?.name ?? warehouseCode ?? '—'

  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Warehouse size={20} /> Kho phôi
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Đoạn sắt tồn tại <b>{whName}</b>, tách theo mã đoạn (cỡ + công đoạn). Phôi KCS đạt thì đoạn tự vào tồn và <b>giữ cho lệnh</b>;
        Hàn / Sơn báo thì tự trừ phần giữ của lệnh. Phần cắt vượt vào cột <b>Dư</b> của xưởng, chia cho lệnh sau.
      </div>

      {!lockedWarehouseCode && warehouses.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {warehouses.map(w => (
            <button key={w.code} onClick={() => setWarehouseCode(w.code)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', border: '1px solid',
                borderColor: w.code === warehouseCode ? 'var(--fg-e65100)' : 'var(--border)',
                background: w.code === warehouseCode ? 'var(--bg-fff3e0)' : 'var(--surface)',
                color: w.code === warehouseCode ? 'var(--fg-e65100)' : 'var(--text2)',
              }}>
              {w.name}
            </button>
          ))}
        </div>
      )}

      {/* Tab switch */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <TabBtn active={tab === 'duyet'} onClick={() => setTab('duyet')} icon={<Check size={15} />}
          label="Đoạn chuẩn" badge={tongDuyet} />
        <TabBtn active={tab === 'thua'} onClick={() => setTab('thua')} icon={<Scissors size={15} />}
          label="Đoạn thừa (chờ xử lý)" badge={tongThua} />
      </div>

      {coAm && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-fef2f2)', color: 'var(--fg-b91c1c)', fontSize: 13 }}>
          Có số âm — dữ liệu cũ (trước khi quản đoạn theo lệnh) chưa chuyển đổi. Báo IT; thủ kho chỉnh lại khi kiểm kê.
        </div>
      )}

      <KhoTable rows={rows} thua={tab === 'thua'} onStocktake={canStocktake ? setKiemKe : undefined} />
      {canStocktake && (
        <KiemKeModal row={kiemKe} onClose={() => setKiemKe(null)} onDone={() => { setKiemKe(null); refetch() }} />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: number }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
        border: '1px solid', borderColor: active ? 'var(--fg-e65100)' : 'var(--border)', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--bg-fff3e0)' : 'var(--surface)', color: active ? 'var(--fg-e65100)' : 'var(--text2)',
      }}>
      {icon}{label}
      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? 'var(--bg-e65100)' : 'var(--surface2)', color: active ? '#fff' : 'var(--text3)' }}>{fmt(badge)}</span>
    </button>
  )
}

const qtyColor = (n: number, base: string) => (n < 0 ? 'var(--fg-b91c1c)' : n === 0 ? 'var(--text3)' : base)

// ── Bảng: Mã đoạn · Tồn · Giữ cho lệnh · Dư · ĐVT ────────────────
function KhoTable({ rows, thua, onStocktake }: { rows: BeSegmentBalance[]; thua: boolean; onStocktake?: (r: BeSegmentBalance) => void }) {
  return (
    <div style={card}>
      <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup><col /><col style={{ width: 90 }} /><col style={{ width: 110 }} /><col style={{ width: 90 }} /><col style={{ width: 60 }} />{onStocktake && <col style={{ width: 96 }} />}</colgroup>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={th}>Mã đoạn</th>
            <th style={thR}>Tồn</th>
            <th style={thR}>Giữ cho lệnh</th>
            <th style={thR}>Dư</th>
            <th style={th}>ĐVT</th>
            {onStocktake && <th style={th} />}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.segmentSpecId}|${r.segmentSteps}`} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{tenDoan(r)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: qtyColor(r.onHandQty, 'var(--fg-e65100)') }}>{fmt(r.onHandQty)}</td>
              <td style={{ ...tdR, color: qtyColor(r.heldQty, 'var(--text)') }}
                title={r.holdingOrderCount > 0 ? `${r.holdingOrderCount} lệnh đang giữ` : undefined}>
                {fmt(r.heldQty)}{r.holdingOrderCount > 0 && <span style={{ color: 'var(--text3)', fontSize: 11 }}> ({r.holdingOrderCount} lệnh)</span>}
              </td>
              <td style={{ ...tdR, fontWeight: 600, color: qtyColor(r.surplusQty, 'var(--fg-d97706)') }}>{fmt(r.surplusQty)}</td>
              <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
              {onStocktake && (
                <td style={td}>
                  <button onClick={() => onStocktake(r)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>Kiểm kê</button>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={onStocktake ? 6 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">{thua ? 'Chưa có đoạn thừa' : 'Chưa có đoạn nào trong kho'}</div></td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Kiểm kê 1 mã đoạn: thủ kho nhập SỐ ĐẾM (không phải số chênh) + ghi chú; BE so tồn lúc mở hộp, lệch thì báo tải lại. */
function KiemKeModal({ row, onClose, onDone }: { row: BeSegmentBalance | null; onClose: () => void; onDone: () => void }) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<BeSegmentBalance | null>(null)
  if (row !== openedFor) {
    // Mở cho dòng khác: đặt lại số (đặt state lúc render thay vì effect).
    setOpenedFor(row)
    setCounted(row ? String(row.onHandQty > 0 ? row.onHandQty : 0) : '')
    setNote('')
    setErr(null)
  }
  if (!row) return null
  const n = Number(counted.replace(',', '.'))
  const valid = counted.trim() !== '' && Number.isFinite(n) && n >= 0 && note.trim().length >= 3
  const delta = valid ? Math.round((n - row.onHandQty) * 1e4) / 1e4 : null

  const submit = async () => {
    if (!valid) return
    setBusy(true)
    setErr(null)
    try {
      await api.stocktakeSegment({
        warehouseId: row.warehouseId,
        segmentSpecId: row.segmentSpecId,
        segmentSteps: row.segmentSteps,
        countedQty: n,
        expectedCurrentQty: row.onHandQty,
        note: note.trim(),
      })
      onDone()
    } catch (e) {
      setErr(errMsg(e, 'Không ghi được kiểm kê'))
    } finally {
      setBusy(false)
    }
  }

  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }
  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={420} zIndex={2000}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Kiểm kê đoạn</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        {tenDoan(row)} · {row.warehouseName}<br />
        Tồn hệ thống <b>{fmt(row.onHandQty)}</b>, đang giữ cho lệnh <b>{fmt(row.heldQty)}</b>.
      </p>
      <label style={{ fontSize: 12, fontWeight: 600 }}>Số đếm được (đoạn)</label>
      <input value={counted} onChange={e => setCounted(e.target.value)} inputMode="decimal" autoFocus style={{ ...input, margin: '4px 0 10px' }} />
      <label style={{ fontSize: 12, fontWeight: 600 }}>Ghi chú (bắt buộc)</label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="vd Kiểm kê cuối tuần" style={{ ...input, marginTop: 4, resize: 'vertical' }} />
      {delta !== null && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          Chênh: <b style={{ color: delta < 0 ? 'var(--fg-b91c1c)' : delta > 0 ? 'var(--fg-15803d)' : 'var(--text3)' }}>{delta > 0 ? '+' : ''}{fmt(delta)}</b>
          {n < row.heldQty && <div style={{ color: 'var(--fg-d97706)', marginTop: 4 }}>Số đếm ít hơn phần đang giữ cho lệnh — Hàn / Sơn sẽ thiếu đoạn (ghi sổ báo vượt).</div>}
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
