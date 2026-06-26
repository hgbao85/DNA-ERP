import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { AlertCircle, Phone, Plus, X, ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ReceivePiece {
  piFramePieceId: number; piCode: string; poNumber: string | null; productLabel: string
  pieceName: string; pieceCode: string; dispatched: number; received: number; notReceived: number
}
interface ReceivePoint { id: number; code: string; fullName: string | null; phone: string | null; totalPending: number; pieces: ReceivePiece[] }
interface Warehouse { id: number; name: string; isActive: boolean }
interface ReceiptRow {
  id: number; receivedDate: string; pointCode: string; pointName: string | null
  pieceName: string; pieceCode: string; piCode: string; poNumber: string | null
  productLabel: string; warehouseName: string; quantity: number; by: string | null; note: string | null
}

// ── Màn ĐIỀU PHỐI ĐAN: thu mảnh đã đan về + chia kho (Nghĩa/Trinh/Hân) ───────────
export default function DieuPhoiDanPage({ readOnly = false }: { readOnly?: boolean }) {
  const [section, setSection] = useState<'list' | 'history'>('list')

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Điều phối đan</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text3)' }}>
        Điểm đan giao hàng về → thu + chia cho các kho (Nghĩa / Trinh / Hân).
      </p>

      {/* Internal section switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['list', 'history'] as const).map(s => {
          const labels = { list: 'Danh sách điều phối', history: 'Lịch sử' }
          const active = section === s
          return (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                padding: '7px 16px', fontSize: 13, fontWeight: active ? 700 : 400,
                border: 'none', background: 'none', cursor: 'pointer',
                color: active ? '#e65100' : 'var(--text3)',
                borderBottom: active ? '2px solid #e65100' : '2px solid transparent',
                marginBottom: -1,
              }}
            >{labels[s]}</button>
          )
        })}
      </div>

      {section === 'list' && <DieuPhoiList readOnly={readOnly} />}
      {section === 'history' && <LichSuSection />}
    </div>
  )
}

// ── Section: Danh sách điều phối ──────────────────────────────────────────────
function DieuPhoiList({ readOnly }: { readOnly: boolean }) {
  const { data, isLoading, error, refetch } = useFetch<ReceivePoint[]>(() => api.getWeavingReceivePending(), [])
  const { data: whRaw } = useFetch<Warehouse[]>(() => api.getMfgWarehouses(), [])
  const [showDone, setShowDone] = useState(false)
  const points = Array.isArray(data) ? data : []
  const warehouses = (Array.isArray(whRaw) ? whRaw : []).filter((w) => w.isActive)

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  const totalGiao = points.reduce((s, p) => s + p.pieces.reduce((a, x) => a + x.dispatched, 0), 0)
  const totalThu = points.reduce((s, p) => s + p.pieces.reduce((a, x) => a + x.received, 0), 0)
  const totalChuaThu = points.reduce((s, p) => s + p.totalPending, 0)
  const pendingCount = points.filter((p) => p.totalPending > 0).length
  const visible = showDone ? points : points.filter((p) => p.totalPending > 0)

  if (points.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa cấp mảnh nào ra điểm đan.</div>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>Điểm đang chờ thu: <strong style={{ color: pendingCount > 0 ? '#e65100' : '#2e7d32' }}>{pendingCount}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Đã giao: <strong style={{ color: 'var(--text)' }}>{totalGiao}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Đã thu: <strong style={{ color: '#2e7d32' }}>{totalThu}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Chưa thu: <strong style={{ color: '#e65100' }}>{totalChuaThu}</strong></span>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ cursor: 'pointer' }} />
          Hiện cả điểm đã thu đủ
        </label>
      </div>

      {visible.length === 0 && (
        <div style={{ color: '#2e7d32', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> Tất cả mảnh đã thu về kho — không còn điểm nào chờ thu.
        </div>
      )}

      {visible.map((pt) => {
        const pending = pt.totalPending > 0
        return (
          <div key={pt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 18, overflow: 'hidden', opacity: pending ? 1 : 0.85 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{pt.code}
                  {pt.fullName && <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {pt.fullName}</span>}
                </div>
                {pt.phone && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Phone size={11} /> {pt.phone}</div>}
              </div>
              {pending ? (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#fff3e0', color: '#e65100' }}>Chưa thu {pt.totalPending} mảnh</span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#e8f5e9', color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} /> Đã thu đủ</span>
              )}
            </div>
            <div style={{ padding: 12 }}>
              {pt.pieces.map((pc) => (
                <NhapDanPieceCard key={pc.piFramePieceId} pointId={pt.id} piece={pc} warehouses={warehouses} onChanged={refetch} readOnly={readOnly} />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Section: Lịch sử ──────────────────────────────────────────────────────────
function LichSuSection() {
  const { data, isLoading, error } = useFetch<ReceiptRow[]>(() => api.getWeavingReceiptHistory(), [])
  const rows = Array.isArray(data) ? data : []

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>
  if (rows.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có lần nhập đan nào.</div>

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ngày', 'Điểm đan', 'Mảnh', 'Lệnh SX / PO', 'Kho nhận', 'Số lượng', 'Người thu'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 5 ? 'right' : 'left', padding: '8px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{format(new Date(r.receivedDate), 'dd/MM/yyyy')}</td>
                <td style={td}><strong>{r.pointCode}</strong>{r.pointName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.pointName}</div>}</td>
                <td style={td}><strong>{r.pieceName}</strong> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{r.pieceCode}</span></td>
                <td style={{ ...td, fontSize: 12 }}>{r.poNumber ?? r.piCode}<div style={{ color: 'var(--text3)' }}>{r.productLabel}</div></td>
                <td style={td}>{r.warehouseName}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#2e7d32' }}>{r.quantity}</td>
                <td style={{ ...td, fontSize: 12, color: 'var(--text2)' }}>{r.by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' }

function NhapDanPieceCard({ pointId, piece, warehouses, onChanged, readOnly = false }: { pointId: number; piece: ReceivePiece; warehouses: Warehouse[]; onChanged: () => void; readOnly?: boolean }) {
  type Row = { mfgWarehouseId: number | ''; quantity: string }
  const [rows, setRows] = useState<Row[]>([{ mfgWarehouseId: '', quantity: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const done = piece.notReceived <= 0
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { mfgWarehouseId: '', quantity: '' }])
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))
  const totalReceiving = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const afterRemaining = piece.notReceived - totalReceiving

  const submit = async () => {
    const distributions = rows
      .filter((r) => r.mfgWarehouseId !== '' && Number(r.quantity) > 0)
      .map((r) => ({ mfgWarehouseId: Number(r.mfgWarehouseId), quantity: Number(r.quantity) }))
    if (distributions.length === 0) { setErr('Chọn kho và nhập số lượng thu'); return }
    try {
      setBusy(true); setErr('')
      await api.receiveWeaving({ piFramePieceId: piece.piFramePieceId, weavingPointId: pointId, distributions })
      setRows([{ mfgWarehouseId: '', quantity: '' }])
      onChanged()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi nhập đan')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 13 }}>
          <strong>{piece.pieceName}</strong> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{piece.pieceCode}</span>
          <span style={{ color: 'var(--text3)', marginLeft: 8 }}>· {piece.poNumber ?? piece.piCode} · {piece.productLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, alignItems: 'center' }}>
          <span>Đã xuất: <strong>{piece.dispatched}</strong></span>
          <span>Đã thu: <strong style={{ color: '#2e7d32' }}>{piece.received}</strong></span>
          <span>Chưa thu: <strong style={{ color: done ? '#2e7d32' : '#e65100' }}>{piece.notReceived}</strong></span>
          {done && <span style={{ color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}><CheckCircle2 size={13} /> Đủ</span>}
        </div>
      </div>

      {readOnly || done ? null : <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 2px 4px', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
          <span style={{ flex: 1, minWidth: 160 }}>Kho nhận</span>
          <span style={{ width: 110, textAlign: 'center' }}>Số mảnh</span>
          <span style={{ width: 34 }} />
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={r.mfgWarehouseId} onChange={(e) => setRow(i, { mfgWarehouseId: e.target.value === '' ? '' : Number(e.target.value) })}
              style={{ flex: 1, minWidth: 160, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)' }}>
              <option value="">— Chọn kho —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="number" min={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} placeholder="0"
              style={{ width: 110, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center', background: 'var(--surface)', boxSizing: 'border-box' }} />
            <button onClick={() => removeRow(i)} disabled={rows.length === 1} title="Bớt dòng"
              style={{ width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: rows.length === 1 ? 'default' : 'pointer', opacity: rows.length === 1 ? 0.4 : 1 }}>
              <X size={14} color="var(--text3)" />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <button onClick={addRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Thêm kho
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Đang thu: <strong style={{ color: 'var(--text)' }}>{totalReceiving}</strong> / chưa thu {piece.notReceived} ·
              còn <strong style={{ color: afterRemaining < 0 ? '#c62828' : '#1565c0' }}>{afterRemaining}</strong>
            </span>
            <button onClick={submit} disabled={busy || afterRemaining < 0} title={afterRemaining < 0 ? 'Tổng thu vượt số chưa thu' : ''}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: afterRemaining < 0 ? 'var(--text3)' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: busy || afterRemaining < 0 ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              <ArrowDownToLine size={14} /> Nhập kho
            </button>
          </div>
        </div>
        {err && <div style={{ marginTop: 8, background: '#ffebee', color: '#c62828', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12 }}>{err}</div>}
      </div>}
    </div>
  )
}
