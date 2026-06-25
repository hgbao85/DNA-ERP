import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Plus, X, ArrowDownToLine, PackagePlus } from 'lucide-react'

// ── Bảng theo MẢNH đan: cần | đã thu | chưa xuất đan | chưa thu + nút Nhập mảnh ──
// Dùng CHUNG cho thẻ "Đan" ở Bảng tiến độ + → số liệu không lệch.
// 3 cột (đã thu + chưa thu + chưa xuất đan) cộng lại = cần. % đan = Σ đã thu / Σ cần.

export interface ManhPiece {
  id: number; name: string; code: string; groupNumber: number; pieceNumber: number
  target: number; waiting: number; allocated: number; received: number; notReceived: number; remaining: number
}
export interface ManhPI {
  piId: number; code: string; poNumber: string | null; productLabel: string; totalBo: number; pieces: ManhPiece[]
}

const th: React.CSSProperties = { textAlign: 'right', padding: '8px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }

export default function DanManhPanel({ pi, readOnly = false, onChanged }: { pi: ManhPI; readOnly?: boolean; onChanged?: () => void }) {
  const [nhapPiece, setNhapPiece] = useState<ManhPiece | null>(null)
  const pieces = Array.isArray(pi?.pieces) ? pi.pieces : []
  const totalCan = pieces.reduce((s, p) => s + p.target, 0)
  const totalThu = pieces.reduce((s, p) => s + p.received, 0)
  const pct = totalCan > 0 ? Math.round((totalThu / totalCan) * 100) : 0

  if (pieces.length === 0) {
    return <div style={{ color: 'var(--text3)', fontSize: 13, padding: 16 }}>Lệnh SX này không có mảnh đan.</div>
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header: % đan tổng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Đan <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>· thu về / cần</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, background: 'var(--surface)', borderRadius: 6, height: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2e7d32' : '#e65100', transition: 'width .3s' }} />
          </div>
          <strong style={{ fontSize: 16, color: pct === 100 ? '#2e7d32' : 'var(--text)' }}>{pct}%</strong>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Mảnh</th>
              <th style={th}>Số lượng cần</th>
              <th style={th}>Đã thu</th>
              <th style={th}>Chưa xuất đan</th>
              <th style={th}>Chưa thu</th>
              {!readOnly && <th style={{ ...th, textAlign: 'center' }} />}
            </tr>
          </thead>
          <tbody>
            {pieces.map((p) => (
              <tr key={p.id}>
                <td style={{ ...td, textAlign: 'left' }}>
                  <strong>{p.name}</strong> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{p.code}</span>
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{p.target}</td>
                <td style={{ ...td, color: p.received > 0 ? '#2e7d32' : 'var(--text3)', fontWeight: 600 }}>{p.received}</td>
                <td style={{ ...td, color: p.remaining > 0 ? 'var(--text2)' : 'var(--text3)' }}>{p.remaining}</td>
                <td style={{ ...td, color: p.notReceived > 0 ? '#e65100' : 'var(--text3)', fontWeight: 600 }}>{p.notReceived}</td>
                {!readOnly && (
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => setNhapPiece(p)} disabled={p.notReceived <= 0}
                      title={p.notReceived <= 0 ? 'Không có mảnh đang chờ thu' : 'Nhập mảnh thu về'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: p.notReceived <= 0 ? 'var(--surface2)' : '#2e7d32', color: p.notReceived <= 0 ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: p.notReceived <= 0 ? 'default' : 'pointer' }}>
                      <PackagePlus size={13} /> Nhập mảnh
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface2)' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>Tổng</td>
              <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{totalCan}</td>
              <td style={{ ...td, fontWeight: 700, color: '#2e7d32', borderBottom: 'none' }}>{totalThu}</td>
              <td style={{ ...td, fontWeight: 700, borderBottom: 'none' }}>{pieces.reduce((s, p) => s + p.remaining, 0)}</td>
              <td style={{ ...td, fontWeight: 700, color: '#e65100', borderBottom: 'none' }}>{pieces.reduce((s, p) => s + p.notReceived, 0)}</td>
              {!readOnly && <td style={{ ...td, borderBottom: 'none' }} />}
            </tr>
          </tfoot>
        </table>
      </div>

      {nhapPiece && (
        <NhapManhModal piece={nhapPiece} onClose={() => setNhapPiece(null)} onDone={() => { setNhapPiece(null); onChanged?.() }} />
      )}
    </div>
  )
}

// ── Modal Nhập mảnh: thu 1 mảnh từ 1 điểm đan đang giữ → chia vào kho ────────────
interface PendingPoint { id: number; code: string; pieces: { piFramePieceId: number; notReceived: number }[] }
interface Warehouse { id: number; name: string; isActive: boolean }

function NhapManhModal({ piece, onClose, onDone }: { piece: ManhPiece; onClose: () => void; onDone: () => void }) {
  const { data: pendingRaw } = useFetch<PendingPoint[]>(() => api.getWeavingReceivePending(), [])
  const { data: whRaw } = useFetch<Warehouse[]>(() => api.getMfgWarehouses(), [])
  const warehouses = (Array.isArray(whRaw) ? whRaw : []).filter((w) => w.isActive)

  // Các điểm đan đang giữ mảnh này (chưa thu hết)
  const holders = (Array.isArray(pendingRaw) ? pendingRaw : [])
    .map((pt) => {
      const pc = pt.pieces.find((x) => x.piFramePieceId === piece.id)
      return pc && pc.notReceived > 0 ? { pointId: pt.id, code: pt.code, notReceived: pc.notReceived } : null
    })
    .filter((x): x is { pointId: number; code: string; notReceived: number } => x !== null)

  const [pointId, setPointId] = useState<number | ''>('')
  const [rows, setRows] = useState<{ mfgWarehouseId: number | ''; quantity: string }[]>([{ mfgWarehouseId: '', quantity: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const holder = holders.find((h) => h.pointId === pointId)
  const totalReceiving = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const afterRemaining = (holder?.notReceived ?? 0) - totalReceiving

  const setRow = (i: number, patch: Partial<{ mfgWarehouseId: number | ''; quantity: string }>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { mfgWarehouseId: '', quantity: '' }])
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  const submit = async () => {
    if (!pointId) { setErr('Chọn điểm đan giao về'); return }
    const distributions = rows
      .filter((r) => r.mfgWarehouseId !== '' && Number(r.quantity) > 0)
      .map((r) => ({ mfgWarehouseId: Number(r.mfgWarehouseId), quantity: Number(r.quantity) }))
    if (distributions.length === 0) { setErr('Chọn kho và nhập số lượng thu'); return }
    try {
      setBusy(true); setErr('')
      await api.receiveWeaving({ piFramePieceId: piece.id, weavingPointId: Number(pointId), distributions })
      onDone()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi nhập mảnh')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Nhập mảnh thu về</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}><strong>{piece.name}</strong> · {piece.code}</div>
          </div>
          <button onClick={onClose} style={{ padding: 5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' }}><X size={15} /></button>
        </div>

        {holders.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>Không có điểm đan nào đang giữ mảnh này để thu.</div>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>Điểm đan giao về *</div>
              <select value={pointId} onChange={(e) => setPointId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)' }}>
                <option value="">— Chọn điểm đan —</option>
                {holders.map((h) => <option key={h.pointId} value={h.pointId}>{h.code} (chưa thu {h.notReceived})</option>)}
              </select>
            </label>

            {holder && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Chia vào kho</div>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select value={r.mfgWarehouseId} onChange={(e) => setRow(i, { mfgWarehouseId: e.target.value === '' ? '' : Number(e.target.value) })}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)' }}>
                      <option value="">— Chọn kho —</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input type="number" min={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} placeholder="0"
                      style={{ width: 100, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center', background: 'var(--surface)', boxSizing: 'border-box' }} />
                    <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                      style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: rows.length === 1 ? 'default' : 'pointer', opacity: rows.length === 1 ? 0.4 : 1 }}>
                      <X size={13} color="var(--text3)" />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                  <button onClick={addRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={14} /> Thêm kho
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Thu: <strong style={{ color: 'var(--text)' }}>{totalReceiving}</strong> / {holder.notReceived} · còn <strong style={{ color: afterRemaining < 0 ? '#c62828' : '#1565c0' }}>{afterRemaining}</strong>
                  </span>
                </div>
              </>
            )}

            {err && <div style={{ marginTop: 10, background: '#ffebee', color: '#c62828', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13 }}>Hủy</button>
              <button onClick={submit} disabled={busy || !holder || afterRemaining < 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: !holder || afterRemaining < 0 ? 'var(--text3)' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: busy || !holder || afterRemaining < 0 ? 'default' : 'pointer', fontSize: 13, opacity: busy ? 0.6 : 1 }}>
                <ArrowDownToLine size={14} /> {busy ? 'Đang lưu...' : 'Nhập kho'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
