import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format, differenceInCalendarDays } from 'date-fns'
import { AlertCircle, ArrowLeft, Send, Trash2, ClipboardList, MapPin, Phone, Calendar, Plus, X } from 'lucide-react'

interface PieceSummary {
  id: number; name: string; code: string; groupNumber: number; pieceNumber: number
  target: number; waiting: number; allocated: number; remaining: number
  received: number; notReceived: number
}
interface FinishedPI {
  piId: number; code: string; poNumber: string | null; productLabel: string; totalBo: number
  pieces: PieceSummary[]
}
interface Allocation { id: number; weavingPointId: number; weavingPointName: string; quantity: number; deadline: string | null }
interface PieceDetail extends PieceSummary { sonCompleted: number; allocations: Allocation[] }
interface AllocationDetail {
  piId: number; code: string; poNumber: string | null; productLabel: string
  minAllocationQty: number; pieces: PieceDetail[]
}
interface WeavingPoint { id: number; code: string; isActive: boolean }
interface PointAssignment {
  id: number; piCode: string; poNumber: string | null; productLabel: string
  pieceName: string; pieceCode: string; quantity: number; completed: number; holding: number; deadline: string | null
}
interface PointLoad { id: number; code: string; fullName: string | null; phone: string | null; totalHolding: number; assignments: PointAssignment[] }

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)' }
const numBadge = (n: number, kind: 'target' | 'wait' | 'done' | 'left'): React.CSSProperties => ({
  display: 'inline-block', minWidth: 44, textAlign: 'center', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 12,
  background: kind === 'wait' ? (n > 0 ? '#fff3e0' : 'var(--surface2)') : kind === 'done' ? '#e8f5e9' : kind === 'left' ? (n > 0 ? '#e3f2fd' : 'var(--surface2)') : 'var(--surface2)',
  color: kind === 'wait' ? (n > 0 ? '#e65100' : 'var(--text3)') : kind === 'done' ? '#2e7d32' : kind === 'left' ? (n > 0 ? '#1565c0' : 'var(--text3)') : 'var(--text2)',
})

// Badge "còn Nn / trễ Nn / hôm nay" theo hạn giao
function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const days = differenceInCalendarDays(new Date(deadline), new Date())
  const color = days < 0 ? '#c62828' : days <= 3 ? '#e65100' : '#2e7d32'
  const bg = days < 0 ? '#ffebee' : days <= 3 ? '#fff3e0' : '#e8f5e9'
  const label = days < 0 ? `trễ ${-days}n` : days === 0 ? 'hôm nay' : `còn ${days}n`
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>
}

// Màn "Thành phẩm khung sơn" — XUẤT/CẤP đan đi (cho Thống kê Phôi + Quản lý SX).
// Phần thu mảnh về (Nhập đan) đã tách sang DieuPhoiDanPage.
export default function KhungSonPage({ readOnly = false }: { readOnly?: boolean }) {
  const [selectedPi, setSelectedPi] = useState<number | null>(null)
  const [mode, setMode] = useState<'by-pi' | 'by-point'>('by-pi')

  if (selectedPi != null) {
    return <AllocationDetailView piId={selectedPi} onBack={() => setSelectedPi(null)} readOnly={readOnly} />
  }

  return (
    <div>
      {/* Toggle góc nhìn */}
      <div style={{ display: 'inline-flex', background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 3, marginBottom: 18, flexWrap: 'wrap' }}>
        {([['by-pi', 'Xuất đan (theo lệnh)', <ClipboardList size={14} key="a" />], ['by-point', 'Theo điểm đan', <MapPin size={14} key="b" />]] as const).map(([m, label, icon]) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? '#e65100' : 'var(--text2)', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'by-pi' && <FinishedFramesSummary onOpen={setSelectedPi} />}
      {mode === 'by-point' && <ByPointView />}
    </div>
  )
}

// ── Màn tổng hợp: Thành phẩm khung sơn (theo lệnh SX) ──────────────────────────
function FinishedFramesSummary({ onOpen }: { onOpen: (piId: number) => void }) {
  const { data, isLoading, error } = useFetch<FinishedPI[]>(() => api.getFinishedFrames(), [])
  const pis = Array.isArray(data) ? data : []

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  const totalPieces = pis.reduce((count, pi) => count + pi.pieces.length, 0)

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Thành phẩm khung sơn</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        Mảnh đã sơn xong + KCS đạt → chờ cấp đi đan. Bấm "Chi tiết cấp đan" để phân cho điểm đan.
      </p>
      {pis.length > 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
          Hiện có {pis.length} lệnh và {totalPieces} mảnh khung sơn chờ cấp đan.
        </div>
      )}

      {pis.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có mảnh khung sơn nào được KCS duyệt.</div>
      )}

      {pis.map((pi) => (
        <div key={pi.piId} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {pi.poNumber ? `PO ${pi.poNumber}` : pi.code}
                <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {pi.code}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{pi.productLabel}</div>
            </div>
            <button onClick={() => onOpen(pi.piId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Send size={14} /> Chi tiết xuất đan
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Mảnh</th>
                <th style={{ ...th, textAlign: 'center' }}>Mục tiêu</th>
                <th style={{ ...th, textAlign: 'center' }}>Chờ xuất đan</th>
                <th style={{ ...th, textAlign: 'center' }}>Đã xuất đan</th>
                <th style={{ ...th, textAlign: 'center' }}>Đã thu</th>
                <th style={{ ...th, textAlign: 'center' }}>Chưa thu</th>
                <th style={{ ...th, textAlign: 'center' }}>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {pi.pieces.map((p) => (
                <tr key={p.id}>
                  <td style={td}>
                    <strong>{p.name}</strong>
                    <span style={{ color: 'var(--text3)', marginLeft: 6, fontSize: 11 }}>#{p.groupNumber}.{p.pieceNumber}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.target, 'target')}>{p.target}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.waiting, 'wait')}>{p.waiting}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.allocated, 'done')}>{p.allocated}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.received, 'done')}>{p.received}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.notReceived, 'wait')}>{p.notReceived}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={numBadge(p.remaining, 'left')}>{p.remaining}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ── Màn đảo chiều: Theo điểm đan ───────────────────────────────────────────────
function ByPointView() {
  const { data, isLoading, error } = useFetch<PointLoad[]>(() => api.getWeavingByPoint(), [])
  // Màn này chỉ quan tâm điểm CÒN đang ôm hàng (endpoint nay trả cả điểm đã về hết).
  const points = (Array.isArray(data) ? data : []).filter((p) => p.totalHolding > 0)

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  const holdingCount = points.reduce((sum, p) => sum + p.totalHolding, 0)

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Cấp đan theo điểm đan</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        Mỗi điểm đan đang ôm bao nhiêu mảnh, của lệnh nào, hẹn về ngày nào — tiện gọi điện đốc.
      </p>
      {points.length > 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
          {points.length} điểm đan đang ôm {holdingCount} mảnh
        </div>
      )}

      {points.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có điểm đan nào đang giữ hàng. Kiểm tra phân bổ hoặc nhập mảnh về kho.</div>
      )}

      {points.map((pt) => (
        <div key={pt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{pt.code}
                {pt.fullName && <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {pt.fullName}</span>}
              </div>
              {pt.phone && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Phone size={11} /> {pt.phone}</div>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Đang ôm: <strong style={{ color: '#e65100', fontSize: 16 }}>{pt.totalHolding}</strong> mảnh</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Lệnh / PO</th>
                <th style={th}>Sản phẩm</th>
                <th style={th}>Mảnh</th>
                <th style={{ ...th, textAlign: 'center' }}>Số mảnh</th>
                <th style={{ ...th, textAlign: 'center' }}>Hạn về</th>
              </tr>
            </thead>
            <tbody>
              {pt.assignments.map((a) => (
                <tr key={a.id}>
                  <td style={td}>
                    <strong>{a.poNumber ?? a.piCode}</strong>
                    {a.poNumber && <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>{a.piCode}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{a.productLabel}</td>
                  <td style={td}>{a.pieceName} <span style={{ color: 'var(--text3)', fontSize: 11 }}>{a.pieceCode}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}><strong>{a.holding}</strong>{a.completed > 0 && <span style={{ color: 'var(--text3)', fontSize: 11 }}> / {a.quantity}</span>}</td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {a.deadline ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {format(new Date(a.deadline), 'dd/MM')} <DeadlineBadge deadline={a.deadline} />
                      </span>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ── Màn chi tiết: Xuất đan cho từng điểm ───────────────────────────────────────
function AllocationDetailView({ piId, onBack, readOnly = false }: { piId: number; onBack: () => void; readOnly?: boolean }) {
  const { data, isLoading, error, refetch } = useFetch<AllocationDetail>(() => api.getWeavingAllocation(piId), [piId])
  const { data: pointsRaw } = useFetch<WeavingPoint[]>(() => api.getWeavingPoints(), [])
  const points = Array.isArray(pointsRaw) ? pointsRaw : []

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error || !data) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>
  if (data.pieces.length === 0) return <div style={{ padding: 40, color: 'var(--text3)' }}>Lệnh này chưa có mảnh khung sơn để xuất đan. Kiểm tra trạng thái KCS hoặc phân bổ mảnh sơn.</div>

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
        <ArrowLeft size={14} /> Về Thành phẩm khung sơn
      </button>
      <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 700 }}>Chi tiết cấp đan</h2>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
        {data.poNumber ? `PO ${data.poNumber} · ` : ''}{data.code} — <strong>{data.productLabel}</strong>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
        Tối thiểu mỗi lần cấp: <strong>{data.minAllocationQty}</strong> mảnh (cấp nốt phần còn lại thì được ít hơn).
      </div>

      {data.pieces.map((p) => (
        <PieceAllocationCard key={p.id} piece={p} points={points} onChanged={refetch} readOnly={readOnly} />
      ))}
    </div>
  )
}

type AllocRow = { weavingPointId: number | ''; quantity: string; deadline: string }
const emptyRow = (): AllocRow => ({ weavingPointId: '', quantity: '', deadline: '' })

function PieceAllocationCard({ piece, points, onChanged, readOnly = false }: { piece: PieceDetail; points: WeavingPoint[]; onChanged: () => void; readOnly?: boolean }) {
  const [rows, setRows] = useState<AllocRow[]>([emptyRow()])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const setRow = (i: number, patch: Partial<AllocRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, emptyRow()])
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  const totalAssigning = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const afterRemaining = piece.waiting - totalAssigning // chờ cấp còn lại sau khi phân các dòng

  const submit = async () => {
    const items = rows
      .filter((r) => r.weavingPointId !== '' && Number(r.quantity) > 0)
      .map((r) => ({ weavingPointId: Number(r.weavingPointId), quantity: Number(r.quantity), deadline: r.deadline || undefined }))
    if (items.length === 0) { setErr('Thêm ít nhất 1 dòng: chọn điểm đan và nhập số mảnh'); return }
    try {
      setBusy(true); setErr('')
      await api.allocateWeavingBulk({ piFramePieceId: piece.id, items })
      setRows([emptyRow()])
      onChanged()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi cấp đan')
    } finally { setBusy(false) }
  }

  const removeAlloc = async (id: number) => {
    try { setBusy(true); setErr(''); await api.removeWeavingAllocation(id); onChanged() }
    catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi hủy cấp')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{piece.name} <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>#{piece.groupNumber}.{piece.pieceNumber}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{piece.code}</div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
          <span>Số lượng tổng: <strong>{piece.target}</strong></span>
          <span>Đã cấp: <strong style={{ color: '#2e7d32' }}>{piece.allocated}</strong></span>
          <span>Còn lại: <strong style={{ color: piece.remaining > 0 ? '#1565c0' : 'var(--text3)' }}>{piece.remaining}</strong></span>
          <span style={{ color: 'var(--text3)' }}>Chờ cấp: <strong style={{ color: piece.waiting > 0 ? '#e65100' : 'var(--text3)' }}>{piece.waiting}</strong></span>
        </div>
      </div>

      {/* danh sách điểm đan đã cấp */}
      {piece.allocations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {piece.allocations.map((a) => (
            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f5e9', color: '#2e7d32', borderRadius: 16, padding: '4px 6px 4px 12px', fontSize: 12, fontWeight: 600 }}>
              {a.weavingPointName}: {a.quantity}
              {a.deadline && <DeadlineBadge deadline={a.deadline} />}
              {!readOnly && (
                <button onClick={() => removeAlloc(a.id)} disabled={busy} title="Hủy cấp" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#2e7d32' }}>
                  <Trash2 size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* form cấp NHIỀU điểm đan cùng lúc — mỗi dòng 1 hàng kiểu bảng */}
      {readOnly ? null : piece.waiting > 0 ? (
        <div style={{ marginTop: 12 }}>
          {/* tiêu đề cột */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 2px 4px', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
            <span style={{ flex: 1, minWidth: 180 }}>Điểm đan</span>
            <span style={{ width: 110, textAlign: 'center' }}>Số mảnh</span>
            <span style={{ width: 165 }}>Hạn về (tùy chọn)</span>
            <span style={{ width: 34 }} />
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={r.weavingPointId} onChange={(e) => setRow(i, { weavingPointId: e.target.value === '' ? '' : Number(e.target.value) })}
                style={{ flex: 1, minWidth: 180, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)' }}>
                <option value="">— Chọn điểm đan —</option>
                {points.map((pt) => <option key={pt.id} value={pt.id}>{pt.code}</option>)}
              </select>
              <input type="number" min={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} placeholder="0"
                style={{ width: 110, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center', background: 'var(--surface)', boxSizing: 'border-box' }} />
              <div style={{ width: 165, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '0 6px 0 8px', height: 35, boxSizing: 'border-box' }}>
                <Calendar size={13} color="var(--text3)" />
                <input type="date" value={r.deadline} onChange={(e) => setRow(i, { deadline: e.target.value })}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text)', padding: '7px 0', width: '100%' }} />
              </div>
              <button onClick={() => removeRow(i)} disabled={rows.length === 1} title="Bớt dòng"
                style={{ width: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: rows.length === 1 ? 'default' : 'pointer', opacity: rows.length === 1 ? 0.4 : 1 }}>
                <X size={14} color="var(--text3)" />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            <button onClick={addRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Thêm điểm
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Đang phân: <strong style={{ color: 'var(--text)' }}>{totalAssigning}</strong> / chờ cấp {piece.waiting} ·
                còn <strong style={{ color: afterRemaining < 0 ? '#c62828' : '#1565c0' }}>{afterRemaining}</strong>
              </span>
              <button onClick={submit} disabled={busy || afterRemaining < 0} title={afterRemaining < 0 ? 'Tổng vượt quá số chờ cấp' : ''}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: afterRemaining < 0 ? 'var(--text3)' : '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: busy || afterRemaining < 0 ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                <Send size={14} /> Cấp đan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
          {piece.allocated >= piece.target ? '✓ Đã cấp đủ mục tiêu' : 'Chưa có khung sơn KCS-đạt mới để cấp'}
        </div>
      )}

      {err && <div style={{ marginTop: 10, background: '#ffebee', color: '#c62828', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12 }}>{err}</div>}
    </div>
  )
}
