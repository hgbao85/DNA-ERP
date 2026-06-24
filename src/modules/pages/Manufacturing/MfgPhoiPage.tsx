import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { PhoiOperation } from '../../../context/AuthContext'
import { format } from 'date-fns'
import { AlertCircle, Check, X, Send, PackagePlus, BarChart2, Layers, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import MfgFailReviewModal, { type FailPayload } from './MfgFailReviewModal'

// ── Constants ─────────────────────────────────────────────────────────────────
const OP_ORDER: PhoiOperation[] = ['CAT', 'TOP_DAU', 'UON', 'DAP', 'DUC_LO', 'BAN_TAN']
const OP_LABEL: Record<PhoiOperation, string> = {
  CAT: 'Cắt', TOP_DAU: 'Tốp đầu', UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', BAN_TAN: 'Bắn tán',
}
const OP_COLOR: Record<PhoiOperation, { bg: string; color: string }> = {
  CAT:    { bg: '#e3f2fd', color: '#1565c0' },
  TOP_DAU:{ bg: '#e0f7fa', color: '#00838f' },
  UON:    { bg: '#f3e5f5', color: '#6a1b9a' },
  DAP:    { bg: '#e8f5e9', color: '#2e7d32' },
  DUC_LO: { bg: '#fff3e0', color: '#e65100' },
  BAN_TAN:{ bg: '#fce4ec', color: '#880e4f' },
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OpStat { operation: PhoiOperation; passed: number; pending: number; failed: number; available: number }
interface PhoiPiece {
  id: number // PIFramePieceId
  framePieceId: number
  code: string
  name: string
  groupNumber: number
  pieceNumber: number
  targetQuantity: number
  requiredOps: PhoiOperation[]
  completedQuantity: number
  failedQuantity: number
  remaining: number
  byOperation: OpStat[]
  materials?: PieceMaterial[]
}
interface MatOpStat { target: number; passed: number; pending: number; failed: number; remaining: number }
interface PieceMaterial {
  framePieceMaterialId: number
  name: string; unit: string; spec?: string | null
  cutLengthMm?: number | null; piecesPerFrame?: number | null; operations: PhoiOperation[]
  byOp: Record<string, MatOpStat>
}
interface PendingReport {
  id: number; piFramePieceId: number; framePieceMaterialId?: number | null
  pieceName: string; materialName?: string; materialLabel?: string
  operation: PhoiOperation; quantity: number; note?: string
  reportedBy?: { id: number; name: string }; reportedAt?: string; createdAt: string
}
interface PhoiItem {
  quantity: number; productName: string; factoryCode: string; colorCode?: string | null; description: string
}
interface FailedReport {
  id: number; pieceName: string; materialName?: string; materialLabel?: string
  operation: PhoiOperation; quantity: number
  defectReason?: { id: number; label: string } | null; reviewNote?: string | null; defectPhotoUrl?: string | null
  reviewedBy?: { id: number; name: string } | null; reviewedAt?: string | null
}
interface PhoiData {
  piId: number; code: string; poNumber?: string | null; deadline: string; items: PhoiItem[]
  pieces: PhoiPiece[]; pendingReports: PendingReport[]; failedReports: FailedReport[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
// datetime-local "YYYY-MM-DDTHH:mm" theo giờ địa phương
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const emptyStat: OpStat = { operation: 'CAT', passed: 0, pending: 0, failed: 0, available: 0 }
const getOp = (p: PhoiPiece, op: PhoiOperation): OpStat =>
  p.byOperation.find(o => o.operation === op) ?? { ...emptyStat, operation: op }

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  piId: number
  /** Khi truyền từ ngoài (MfgApp/MfgPhoiWorkerPage), tab nav nội bộ bị ẩn */
  subTab?: 'tong-hop' | 'chi-tiet'
  /** Quản lý xem drill-down — ẩn mọi thao tác báo cáo/duyệt/seed */
  readOnly?: boolean
  /** % công đoạn Phôi từ ProductionStage — dùng cho lệnh cũ không có dữ liệu theo mảnh */
  stageProgress?: number
  /** Trạng thái công đoạn Phôi (DONE/IN_PROGRESS/PENDING) */
  stageStatus?: string
}

export default function MfgPhoiPage({ piId, subTab: subTabProp, readOnly = false, stageProgress, stageStatus }: Props) {
  const { user } = useAuth()
  // Giám đốc (MANAGER không mfgRole) chỉ XEM — không báo/duyệt (đồng bộ MfgRolesGuard backend).
  // Tài khoản phôi = nhân viên thống kê xưởng: 1 người ghi nhận MỌI công đoạn (không khóa 1 công đoạn).
  const isPhoiStaff = user?.mfgRole === 'PHOI' || !!user?.phoiOperation
  const canReport = !readOnly && (isPhoiStaff || user?.mfgRole === 'PRODUCTION_MANAGER')
  const canReview = !readOnly && (user?.mfgRole === 'QC' || user?.mfgRole === 'PRODUCTION_MANAGER')
  const canSeed   = !readOnly && (user?.mfgRole === 'PRODUCTION_MANAGER')

  // Nếu subTab được điều khiển từ ngoài → dùng prop; ngược lại dùng state nội bộ
  const [subTabLocal, setSubTabLocal] = useState<'tong-hop' | 'chi-tiet'>('tong-hop')
  const subTab = subTabProp ?? subTabLocal
  const setSubTab = subTabProp ? (_: 'tong-hop' | 'chi-tiet') => {} : setSubTabLocal
  const showTabNav = !subTabProp

  const { data, isLoading, error, refetch } = useFetch<PhoiData>(() => api.getPhoiExecutions(piId), [piId])

  const [busy, setBusy]     = useState(false)
  const [formErr, setFormErr] = useState('')
  const [failTarget, setFailTarget] = useState<PendingReport | null>(null)
  // Form state mỗi công đoạn: chọn dòng cắt (mảnh+nguyên liệu) + số lượng + ghi chú
  // matKey = `${piFramePieceId}:${framePieceMaterialId}`
  const [reportForm, setReportForm] = useState<Record<PhoiOperation, { matKey: string; qty: string; time: string }>>(
    () => OP_ORDER.reduce((acc, op) => ({ ...acc, [op]: { matKey: '', qty: '', time: '' } }), {} as Record<PhoiOperation, { matKey: string; qty: string; time: string }>)
  )

  const pieces  = Array.isArray(data?.pieces) ? data!.pieces : []
  const pending = Array.isArray(data?.pendingReports) ? data!.pendingReports : []
  const failed = Array.isArray(data?.failedReports) ? data!.failedReports : []
  const piItems = Array.isArray(data?.items) ? data!.items : []

  const handleSeed = async () => {
    try { setBusy(true); await api.seedPhoi(piId); refetch() }
    catch (e: any) { setFormErr(e?.response?.data?.error ?? 'Lỗi tạo dữ liệu phôi') }
    finally { setBusy(false) }
  }

  const handleReport = async (op: PhoiOperation) => {
    const f = reportForm[op]
    if (!f.matKey || !f.qty || Number(f.qty) <= 0) { setFormErr('Chọn nguyên liệu và nhập số lượng > 0'); return }
    const [pieceId, matId] = f.matKey.split(':').map(Number)
    // Thời gian: chỉ trong vòng 24h gần nhất
    const when = f.time ? new Date(f.time) : new Date()
    const now = Date.now()
    if (when.getTime() > now + 60_000) { setFormErr('Thời gian không được ở tương lai'); return }
    if (when.getTime() < now - 24 * 60 * 60 * 1000) { setFormErr('Thời gian chỉ được trong vòng 24 giờ gần nhất'); return }
    try {
      setBusy(true); setFormErr('')
      const payload: Record<string, unknown> = {
        piFramePieceId: pieceId,
        framePieceMaterialId: matId,
        quantity: Number(f.qty),
        reportedAt: when.toISOString(),
        operation: op, // thống kê chọn công đoạn theo section, không khóa theo account
      }
      await api.submitPhoiReport(payload)
      setReportForm(prev => ({ ...prev, [op]: { matKey: '', qty: '', time: '' } }))
      refetch()
    } catch (e: any) {
      setFormErr(e?.response?.data?.error ?? 'Lỗi gửi báo cáo')
    } finally { setBusy(false) }
  }

  const handlePass = async (id: number) => {
    try { setBusy(true); await api.reviewPhoiReport(id, { status: 'PASSED' }); refetch() }
    catch (e: any) { setFormErr(e?.response?.data?.error ?? 'Lỗi duyệt') }
    finally { setBusy(false) }
  }

  const handleFail = async (payload: FailPayload) => {
    if (!failTarget) return
    await api.reviewPhoiReport(failTarget.id, payload)
    setFailTarget(null); refetch()
  }

  // ── Loading / Error ──
  if (isLoading) return <div style={{ padding: 24, color: 'var(--text3)' }}>Đang tải dữ liệu phôi...</div>
  if (error)     return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu phôi</div>

  // ── Không có dữ liệu theo mảnh ──
  if (pieces.length === 0) {
    // Lệnh cũ: stage Phôi đã có tiến độ/hoàn thành nhưng không tách theo mảnh
    // → hiện trạng thái công đoạn thay vì "chưa có dữ liệu", tránh hiểu nhầm là chưa làm
    const hasStageProgress = (stageProgress ?? 0) > 0 || stageStatus === 'DONE' || stageStatus === 'IN_PROGRESS'
    if (hasStageProgress) {
      const done = stageStatus === 'DONE' || (stageProgress ?? 0) >= 100
      const pct = stageProgress ?? (done ? 100 : 0)
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: '40px 24px', textAlign: 'center',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: done ? '#e8f5e9' : '#fff3e0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: done ? '#2e7d32' : '#e65100',
          }}>
            <CheckCircle2 size={28} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: done ? '#2e7d32' : '#e65100', marginBottom: 4 }}>
              Phôi {done ? 'đã hoàn thành' : `đang thực hiện — ${pct}%`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 400, lineHeight: 1.5 }}>
              Lệnh này được tạo trước khi có tính năng theo dõi phôi chi tiết theo mảnh,
              nên chỉ lưu tiến độ tổng của công đoạn{done ? '' : ' (chưa tách Cắt/Uốn/...)'}.
            </div>
          </div>
        </div>
      )
    }

    // Chưa có định mức mảnh — empty state chuẩn
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '48px 24px', textAlign: 'center',
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--surface2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)',
        }}>
          <Layers size={26} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text2)', marginBottom: 4 }}>
            Chưa có dữ liệu phôi
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 380, lineHeight: 1.5 }}>
            {canSeed
              ? 'Sản phẩm trong lệnh này chưa khai báo định mức mảnh, hoặc lệnh được tạo trước khi có tính năng theo dõi phôi.'
              : 'Sản phẩm trong lệnh này chưa được khai báo định mức mảnh để theo dõi phôi.'}
          </div>
        </div>
        {canSeed && (
          <button onClick={handleSeed} disabled={busy} style={{ ...btnPrimary, background: '#e65100' }}>
            <PackagePlus size={15} /> {busy ? 'Đang tạo...' : 'Tạo dữ liệu mảnh từ định mức'}
          </button>
        )}
      </div>
    )
  }

  // Thống kê xưởng thấy & ghi nhận MỌI công đoạn đang dùng trong lệnh (gộp Cắt/Uốn/Đục lỗ/... 1 màn)
  const opsInUse = OP_ORDER.filter(op => pieces.some(p => p.requiredOps.includes(op)))
  const visibleOps = opsInUse

  // Tiến độ Phôi tổng = Σ đạt mọi (mảnh × công đoạn) / Σ mục tiêu; chỉ 100% khi mọi công đoạn xong
  const opAgg = opsInUse.map(op => {
    let target = 0, passed = 0
    pieces.forEach(p => {
      if (!p.requiredOps.includes(op)) return
      target += p.targetQuantity
      passed += getOp(p, op).passed
    })
    return { op, target, passed, pct: target > 0 ? Math.round(passed / target * 100) : 0 }
  })
  const totalUnits = opAgg.reduce((s, o) => s + o.target, 0)
  const doneUnits  = opAgg.reduce((s, o) => s + o.passed, 0)
  const overallPct = totalUnits > 0 ? Math.round(doneUnits / totalUnits * 100) : 0

  // Quy tiến độ ra theo BỘ sản phẩm (1 bộ = nhiều mảnh, theo định mức) thay vì theo mảnh
  const totalBo = piItems.reduce((s, it) => s + (it.quantity || 0), 0)
  const poNumber = data?.poNumber

  return (
    <div>
      {formErr && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13 }}>{formErr}</div>
      )}

      {/* ── Sub-tab nav (chỉ hiện khi không được điều khiển từ ngoài) ── */}
      {showTabNav && (
        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          {([
            { id: 'tong-hop', label: 'Tổng hợp PO',       icon: <BarChart2 size={14}/> },
            { id: 'chi-tiet', label: 'Chi tiết sản xuất', icon: <Layers size={14}/> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', border: 'none', fontSize: 13, cursor: 'pointer',
              borderRadius: 'var(--radius) var(--radius) 0 0',
              background: subTab === t.id ? 'var(--surface)' : 'transparent',
              borderBottom: subTab === t.id ? '2px solid #e65100' : '2px solid transparent',
              color: subTab === t.id ? '#e65100' : 'var(--text2)',
              fontWeight: subTab === t.id ? 700 : 400,
              marginBottom: -2,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MÀN 1 — TỔNG HỢP PO (theo mảnh)
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === 'tong-hop' && (
        <div>
          {/* Header: No PO + sản phẩm + số lượng; tiến độ quy theo BỘ sản phẩm */}
          <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                {/* Tên sản phẩm + số lượng (dòng chính) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {piItems.map((it, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 17 }}>{it.productName}</span>
                      {it.colorCode && <span style={{ fontSize: 13, color: 'var(--text3)' }}>{it.colorCode}</span>}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100', background: '#fff3e0', padding: '2px 10px', borderRadius: 20 }}>
                        ×{fmt(it.quantity)} bộ
                      </span>
                    </span>
                  ))}
                </div>
                {/* PO + lệnh SX (dòng phụ, mờ) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text3)' }}>
                  <span>PO: <strong style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{poNumber ?? '—'}</strong></span>
                  <span>Lệnh SX: <strong style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{data?.code}</strong></span>
                </div>
              </div>
              {/* % tiến độ (khối phải) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tiến độ Phôi</span>
                <span style={{ fontWeight: 800, fontSize: 30, lineHeight: 1, color: overallPct >= 100 ? '#2e7d32' : '#e65100' }}>{overallPct}%</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: overallPct >= 100 ? '#2e7d32' : '#e65100', transition: 'width .3s' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {opAgg.map(o => {
                const c = OP_COLOR[o.op]
                // Quy ra bộ: số bộ đã xong công đoạn này = % × tổng bộ (1 bộ = nhiều mảnh theo định mức)
                const boDone = o.target > 0 ? Math.round(o.passed / o.target * totalBo) : 0
                return (
                  <div key={o.op} style={{ flex: '1 1 120px', minWidth: 120 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: c.color }}>{OP_LABEL[o.op]}</span>
                      <span style={{ fontWeight: 700, color: o.pct >= 100 ? '#2e7d32' : 'var(--text2)' }}>{o.pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${o.pct}%`, background: o.pct >= 100 ? '#2e7d32' : c.color, transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{fmt(boDone)}/{fmt(totalBo)} bộ</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Mảnh', 'Mục tiêu', 'Tiến độ theo công đoạn', 'Đã xong phôi', 'Còn lại'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pieces.map(p => {
                  const done = p.remaining <= 0
                  const pct  = p.targetQuantity > 0 ? Math.round(p.completedQuantity / p.targetQuantity * 100) : 0
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.code}</div>
                      </td>
                      <td style={td}>
                        <span style={{ fontWeight: 700 }}>{fmt(p.targetQuantity)}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}> mảnh</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.requiredOps.map(op => {
                            const b = getOp(p, op)
                            const c = OP_COLOR[op]
                            return (
                              <span key={op} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, fontWeight: 600 }}>
                                {OP_LABEL[op]} {fmt(b.passed)}
                                {b.pending > 0 && <span style={{ opacity: 0.8 }}> +{fmt(b.pending)}⏳</span>}
                                {b.failed  > 0 && <span style={{ color: '#c62828' }}> ✗{fmt(b.failed)}</span>}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 700, color: done ? '#2e7d32' : 'var(--text)' }}>
                          {fmt(p.completedQuantity)} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>mảnh</span>
                        </div>
                        <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden', maxWidth: 80 }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: done ? '#2e7d32' : '#e65100', transition: 'width .3s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{pct}%</div>
                        {p.failedQuantity > 0 && (
                          <div style={{ fontSize: 11, color: '#c62828' }}>lỗi {fmt(p.failedQuantity)}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: done ? '#2e7d32' : '#e65100' }}>
                        {done ? '✓ Đủ' : fmt(p.remaining)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MÀN 2 — CHI TIẾT SẢN XUẤT (theo công đoạn × mảnh, pipeline)
      ═══════════════════════════════════════════════════════════════ */}
      {subTab === 'chi-tiet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleOps.map(op => {
            const c = OP_COLOR[op]
            const f = reportForm[op]
            const opPieces = pieces.filter(p => p.requiredOps.includes(op))
            const pendingForOp = pending.filter(r => r.operation === op)
            const canReportOp  = canReport
            return (
              <div key={op} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: `1px solid ${c.bg}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: c.color }}>{OP_LABEL[op]}</div>
                  {pendingForOp.length > 0 && (
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: '#fff3e0', color: '#e65100', fontWeight: 700 }}>
                      {pendingForOp.length} chờ KCS
                    </span>
                  )}
                </div>

                <div style={{ padding: 16 }}>
                  {(() => {
                    // Danh sách dòng cắt cho công đoạn này = (mảnh × nguyên liệu) cần công đoạn
                    const cutRows = opPieces.flatMap(p =>
                      (p.materials ?? [])
                        .filter(m => m.operations?.includes(op))
                        .map(m => {
                          const s = m.byOp?.[op] ?? { target: 0, passed: 0, pending: 0, failed: 0, remaining: 0 }
                          const specPart = [m.spec, m.cutLengthMm ? `${m.cutLengthMm}mm` : null].filter(Boolean).join(' — ')
                          const label = specPart ? `${m.name}: ${specPart}` : m.name
                          return { key: `${p.id}:${m.framePieceMaterialId}`, pieceName: p.name, label, s }
                        }),
                    )
                    const selRow = cutRows.find(r => r.key === f.matKey)
                    const maxRemain = selRow ? selRow.s.remaining : 0
                    const overLimit = !!selRow && Number(f.qty) > maxRemain
                    return (
                  <>
                  {/* Bảng cắt chi tiết — theo NGUYÊN LIỆU (cây/cái) */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Nguyên liệu</th>
                        <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>Mảnh</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>Cần làm</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>Đạt</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>⏳ Chờ</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>Còn lại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cutRows.map(r => (
                        <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.label}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text3)' }}>{r.pieceName}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(r.s.target)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: r.s.passed > 0 ? '#2e7d32' : 'var(--text3)' }}>{fmt(r.s.passed)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: r.s.pending > 0 ? '#e65100' : 'var(--text3)' }}>{fmt(r.s.pending)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: r.s.remaining > 0 ? '#e65100' : '#2e7d32' }}>{r.s.remaining > 0 ? fmt(r.s.remaining) : '✓ đủ'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Form báo sản lượng — chọn nguyên liệu × quy cách */}
                  {canReportOp && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>Báo sản lượng công đoạn {OP_LABEL[op]}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <label style={{ ...lbl, flex: 1, minWidth: 240 }}>
                          <span style={lblText}>Nguyên liệu × quy cách</span>
                          <select
                            value={f.matKey}
                            onChange={e => {
                              const key = e.target.value
                              // Chọn dòng → tự điền số còn lại + thời gian hiện tại (sửa được)
                              const row = cutRows.find(r => r.key === key)
                              setReportForm(prev => ({ ...prev, [op]: { ...prev[op], matKey: key, qty: key ? String(row?.s.remaining ?? 0) : '', time: key ? toLocalInput(new Date()) : '' } }))
                            }}
                            style={inputS}
                          >
                            <option value="">— chọn —</option>
                            {cutRows.map(r => (
                              <option key={r.key} value={r.key}>{r.pieceName} · {r.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={lbl}>
                          <span style={lblText}>Số lượng{selRow ? ` (tối đa ${fmt(maxRemain)})` : ''}</span>
                          <input type="number" value={f.qty} min={0} max={maxRemain || undefined}
                            onChange={e => setReportForm(prev => ({ ...prev, [op]: { ...prev[op], qty: e.target.value } }))}
                            placeholder="0" style={{ ...inputS, width: 130, borderColor: overLimit ? '#c62828' : 'var(--border)' }} />
                        </label>
                        <label style={lbl}>
                          <span style={lblText}>Thời gian (trong 24h)</span>
                          <input type="datetime-local" value={f.time}
                            min={toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000))}
                            max={toLocalInput(new Date())}
                            onChange={e => setReportForm(prev => ({ ...prev, [op]: { ...prev[op], time: e.target.value } }))}
                            style={{ ...inputS, width: 200 }} />
                        </label>
                        <button onClick={() => handleReport(op)} disabled={busy || overLimit || !f.matKey} style={{ ...btnPrimary, background: c.color, opacity: (busy || overLimit || !f.matKey) ? 0.5 : 1 }}>
                          <Send size={13} /> {busy ? 'Đang gửi...' : 'Gửi → chờ KCS'}
                        </button>
                      </div>
                      {overLimit && (
                        <div style={{ fontSize: 12, color: '#c62828', marginTop: 6 }}>Không được nhập quá số lượng (còn {fmt(maxRemain)})</div>
                      )}
                    </div>
                  )}

                  {/* KCS duyệt */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>
                      Chờ KCS duyệt {pendingForOp.length > 0 && <span style={{ color: '#e65100' }}>({pendingForOp.length})</span>}
                    </div>
                    {pendingForOp.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có báo cáo nào đang chờ</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pendingForOp.map(r => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {r.materialLabel ?? r.pieceName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· mảnh {r.pieceName}</span> · <span style={{ color: c.color }}>{fmt(r.quantity)} cây/cái</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                {r.reportedBy?.name ?? '—'} · lúc {format(new Date(r.reportedAt ?? r.createdAt), 'dd/MM HH:mm')}
                              </div>
                            </div>
                            {canReview ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handlePass(r.id)} disabled={busy} style={btnPass}><Check size={13}/> Đạt</button>
                                <button onClick={() => setFailTarget(r)} disabled={busy} style={btnFail}><X size={13}/> Không đạt</button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chờ duyệt…</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Không đạt (nguyên nhân) cho công đoạn này */}
                  {(() => {
                    const failedForOp = failed.filter(r => r.operation === op)
                    if (failedForOp.length === 0) return null
                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={13}/> Không đạt ({failedForOp.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {failedForOp.map(f => (
                            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 'var(--radius)', padding: '8px 12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 160 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>
                                  {f.materialLabel ?? f.pieceName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· mảnh {f.pieceName}</span> · <span style={{ color: '#c62828' }}>{fmt(f.quantity)} không đạt</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                                  <strong style={{ color: '#c62828' }}>{f.defectReason?.label ?? 'Không rõ'}</strong>
                                  {f.reviewNote && <span style={{ color: 'var(--text3)' }}> — {f.reviewNote}</span>}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                  KCS: {f.reviewedBy?.name ?? '—'}{f.reviewedAt ? ` · ${format(new Date(f.reviewedAt), 'dd/MM HH:mm')}` : ''}
                                </div>
                              </div>
                              {f.defectPhotoUrl
                                ? <a href={f.defectPhotoUrl} target="_blank" rel="noreferrer" title="Xem ảnh lỗi"><img src={f.defectPhotoUrl} alt="lỗi" style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #ffcdd2' }}/></a>
                                : <ImageIcon size={18} color="var(--text3)" style={{ opacity: 0.4 }}/>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  </>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {failTarget && (
        <MfgFailReviewModal
          stageType="PHOI"
          title="Không đạt — Phôi"
          onClose={() => setFailTarget(null)}
          onSubmit={handleFail}
        />
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' }
const lbl: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 3 }
const lblText: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', fontWeight: 600 }
const inputS: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', fontSize: 13 }
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 'var(--radius)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPass: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const btnFail: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 'var(--radius)', color: '#c62828', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
