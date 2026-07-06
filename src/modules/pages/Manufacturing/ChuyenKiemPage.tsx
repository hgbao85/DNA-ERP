import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { AlertCircle, Check, X, Send, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import MfgFailReviewModal, { type FailPayload } from './MfgFailReviewModal'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CKPiece {
  id: number; name: string; code: string; groupNumber: number; pieceNumber: number
  target: number; received: number; inspected: number; failed: number; pending: number; available: number; remaining: number
}
interface CKPendingReport {
  id: number; piFramePieceId: number; pieceName: string; pieceCode: string; quantity: number
  reportedBy: { id: number; name: string } | null; reportedAt: string; note?: string | null
}
interface CKFailedReport {
  id: number; pieceName: string; quantity: number
  defectReason: { id: number; label: string } | null; reviewNote: string | null; defectPhotoUrl: string | null
  reviewedBy: { id: number; name: string } | null; reviewedAt: string | null
}
interface CKPI {
  piId: number; code: string; poNumber: string | null; productLabel: string; totalBo: number
  pieces: CKPiece[]; pendingReports: CKPendingReport[]; failedReports: CKFailedReport[]
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)' }
const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function ChuyenKiemPage({ readOnly = false, filterPiId }: { readOnly?: boolean; filterPiId?: number }) {
  const { data, isLoading, error, refetch } = useFetch<CKPI[]>(() => api.getChuyenKiem(), [])
  const all = Array.isArray(data) ? data : []
  const pis = filterPiId ? all.filter((p) => p.piId === filterPiId) : all
  const piCount = pis.length

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Chuyền kiểm</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        Mảnh đan đã thu về → kiểm KCS từng đợt (đạt/không đạt). Đạt → tính vào &quot;đã kiểm&quot;.
      </p>
      {piCount > 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
          Hiện có {piCount} lệnh chuyền kiểm
        </div>
      )}

      {pis.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có mảnh đan nào thu về để chuyền kiểm. Kiểm tra đơn SX hoặc trạng thái thu mảnh.</div>}

      {pis.map((pi) => <ChuyenKiemPICard key={pi.piId} pi={pi} onChanged={refetch} readOnly={readOnly} />)}
    </div>
  )
}

function ChuyenKiemPICard({ pi, onChanged, readOnly = false }: { pi: CKPI; onChanged: () => void; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [failTarget, setFailTarget] = useState<CKPendingReport | null>(null)
  const [qtyByPiece, setQtyByPiece] = useState<Record<number, string>>({})

  const totalTarget = pi.pieces.reduce((s, p) => s + p.target, 0)
  const totalInspected = pi.pieces.reduce((s, p) => s + p.inspected, 0)
  const overallPct = totalTarget > 0 ? Math.round(totalInspected / totalTarget * 100) : 0

  const report = async (piece: CKPiece) => {
    const q = Number(qtyByPiece[piece.id])
    if (!q || q <= 0) { setErr('Nhập số mảnh kiểm > 0'); return }
    try {
      setBusy(true); setErr('')
      await api.reportChuyenKiem({ piFramePieceId: piece.id, quantity: q })
      setQtyByPiece((m) => ({ ...m, [piece.id]: '' }))
      onChanged()
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi báo kiểm')
    } finally { setBusy(false) }
  }

  const pass = async (id: number) => {
    try { setBusy(true); setErr(''); await api.reviewChuyenKiem(id, { status: 'PASSED' }); onChanged() }
    catch (e) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi duyệt') }
    finally { setBusy(false) }
  }

  const fail = async (payload: FailPayload) => {
    if (!failTarget) return
    await api.reviewChuyenKiem(failTarget.id, payload)
    setFailTarget(null); onChanged()
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 18, overflow: 'hidden' }}>
      {/* Header: PO + sản phẩm + % chuyền kiểm */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {pi.poNumber ? `PO ${pi.poNumber}` : pi.code}
            <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {pi.code}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{pi.productLabel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>Chuyền kiểm</span>
          <span style={{ fontWeight: 800, fontSize: 24, lineHeight: 1, color: overallPct >= 100 ? '#2e7d32' : '#e65100' }}>{overallPct}%</span>
        </div>
      </div>

      {err && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 16px', fontSize: 13 }}>{err}</div>}

      {/* Chi tiết sản xuất mảnh */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Mảnh</th>
            <th style={{ ...th, textAlign: 'center' }}>Mục tiêu</th>
            <th style={{ ...th, textAlign: 'center' }}>Đã tiếp nhận</th>
            <th style={{ ...th, textAlign: 'center' }}>Đã kiểm</th>
            <th style={{ ...th, textAlign: 'center' }}>Còn lại</th>
            <th style={{ ...th, textAlign: 'center' }}>Báo kiểm</th>
          </tr>
        </thead>
        <tbody>
          {pi.pieces.map((p) => {
            const done = p.remaining <= 0
            return (
              <tr key={p.id}>
                <td style={td}>
                  <strong>{p.name}</strong>
                  <span style={{ color: 'var(--text3)', marginLeft: 6, fontSize: 11 }}>#{p.groupNumber}.{p.pieceNumber}</span>
                  {p.failed > 0 && <span style={{ color: '#c62828', fontSize: 11, marginLeft: 6 }}>lỗi {fmt(p.failed)}</span>}
                </td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{fmt(p.target)}</td>
                <td style={{ ...td, textAlign: 'center' }}>{fmt(p.received)}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#2e7d32' }}>
                  {fmt(p.inspected)}
                  {p.pending > 0 && <span style={{ color: '#e65100', fontWeight: 400, fontSize: 11 }}> +{fmt(p.pending)}⏳</span>}
                </td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: done ? '#2e7d32' : '#e65100' }}>{done ? '✓ Đủ' : fmt(p.remaining)}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {readOnly ? (
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                  ) : p.available > 0 ? (
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input type="number" min={1} max={p.available} value={qtyByPiece[p.id] ?? ''}
                        onChange={(e) => setQtyByPiece((m) => ({ ...m, [p.id]: e.target.value }))}
                        placeholder={`≤${p.available}`}
                        style={{ width: 70, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center', background: 'var(--surface)' }} />
                      <button onClick={() => report(p)} disabled={busy}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <Send size={12} /> Kiểm
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>{p.received > 0 ? 'hết phần chưa kiểm' : 'chưa nhận'}</span>
                  )}
                </td>
              </tr>
            )
          })}
          {pi.pieces.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text3)' }}>
                Lệnh này chưa có mảnh đan. Kiểm tra trạng thái thu mảnh hoặc thông tin sản xuất.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Chờ KCS duyệt */}
      {pi.pendingReports.length > 0 && (
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>
            Chờ KCS duyệt <span style={{ color: '#e65100' }}>({pi.pendingReports.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pi.pendingReports.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.pieceName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{r.pieceCode}</span> · <span style={{ color: '#e65100' }}>{fmt(r.quantity)} mảnh</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.reportedBy?.name ?? '—'} · lúc {format(new Date(r.reportedAt), 'dd/MM HH:mm')}</div>
                </div>
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => pass(r.id)} disabled={busy} style={btnPass}><Check size={13} /> Đạt</button>
                    <button onClick={() => setFailTarget(r)} disabled={busy} style={btnFail}><X size={13} /> Không đạt</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Không đạt */}
      {pi.failedReports.length > 0 && (
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> Không đạt ({pi.failedReports.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pi.failedReports.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.pieceName} · <span style={{ color: '#c62828' }}>{fmt(f.quantity)} không đạt</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    <strong style={{ color: '#c62828' }}>{f.defectReason?.label ?? 'Không rõ'}</strong>
                    {f.reviewNote && <span style={{ color: 'var(--text3)' }}> — {f.reviewNote}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>KCS: {f.reviewedBy?.name ?? '—'}{f.reviewedAt ? ` · ${format(new Date(f.reviewedAt), 'dd/MM HH:mm')}` : ''}</div>
                </div>
                {f.defectPhotoUrl
                  ? <a href={f.defectPhotoUrl} target="_blank" rel="noreferrer" title="Xem ảnh lỗi"><img src={f.defectPhotoUrl} alt="lỗi" style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #ffcdd2' }} /></a>
                  : <ImageIcon size={18} color="var(--text3)" style={{ opacity: 0.4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {failTarget && (
        <MfgFailReviewModal stageType="WEAVING" title="Không đạt — Chuyền kiểm" onClose={() => setFailTarget(null)} onSubmit={fail} />
      )}
    </div>
  )
}

const btnPass: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const btnFail: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', color: '#c62828', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
