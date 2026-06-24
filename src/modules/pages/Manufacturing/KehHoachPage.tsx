import { useState, useEffect } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, Clock, PackageSearch, ShoppingCart, Loader2, ChevronDown, ChevronRight, PlayCircle, RefreshCw, Send, X, FilePlus } from 'lucide-react'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface ToastMsg { id: number; title: string; body: string; type: 'success' | 'error' }
let _toastSeq = 0
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = (title: string, body: string, type: ToastMsg['type'] = 'success') => {
    const id = ++_toastSeq
    setToasts(prev => [...prev, { id, title, body, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }
  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))
  return { toasts, push, dismiss }
}
function ToastStack({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}
function ToastItem({ toast, onDismiss }: { toast: ToastMsg; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])
  const isSuccess = toast.type === 'success'
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 16px', borderRadius: 10, maxWidth: 360,
      background: isSuccess ? '#1b5e20' : '#b71c1c',
      color: '#fff', boxShadow: '0 6px 24px rgba(0,0,0,.25)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity .25s ease, transform .25s ease',
    }}>
      <div style={{ marginTop: 2 }}>
        {isSuccess ? <CheckCircle2 size={20} color="#a5d6a7" /> : <AlertCircle size={20} color="#ef9a9a" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{toast.title}</div>
        <div style={{ fontSize: 13, opacity: .88, lineHeight: 1.4 }}>{toast.body}</div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', opacity: .7, padding: 2, display: 'flex' }}>
        <X size={16} />
      </button>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface LmhSummary {
  id: number
  code: string
  status: string
  hasComputed: boolean
  missingCount: number
  totalBuyQty: number
}
interface PIProduct {
  name: string
  factoryCode: string
  colorCode: string | null
  quantity: number
}
interface ActiveProposal {
  id: number
  code: string
  status: string
}
interface PlanningPI {
  id: number
  code: string
  poNumber: string | null
  deadline: string
  materialDeadline: string
  status: string
  exportCustomerName: string | null
  products: PIProduct[]
  lmh: LmhSummary | null
  activeProposal: ActiveProposal | null
}
interface Shortage {
  name: string
  unit: string
  required: number
  stock: number
  buyQty: number
}
interface CheckResult {
  piId: number
  status: string
  shortages: Shortage[]
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PI_STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới',
  PLANNING: 'Lập kế hoạch',
  PURCHASING: 'Đang mua vật tư',
  PRODUCING: 'Đang sản xuất',
  QC_STAGE: 'KCS',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}
const PI_STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  NEW:        { bg: '#f5f5f5', text: '#666',    border: '#ddd' },
  PLANNING:   { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  PURCHASING: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  PRODUCING:  { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  QC_STAGE:   { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  DONE:       { bg: '#e8f5e9', text: '#1b5e20', border: '#66bb6a' },
  CANCELLED:  { bg: '#ffebee', text: '#b71c1c', border: '#ef9a9a' },
}
const LMH_STATUS_LABEL: Record<string, string> = {
  QUOTING:  'Báo giá',
  ORDERED:  'Mua hàng',
  DONE:     'Hoàn thành',
}

const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const th: React.CSSProperties = { ...td, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', background: 'var(--surface2)' }

// ── Main Component ─────────────────────────────────────────────────────────────
export default function KehHoachPage() {
  const { data, isLoading, error, refetch } = useFetch<PlanningPI[]>(api.getPlanningPIs, [])
  const pis = Array.isArray(data) ? data : []

  const [expanded, setExpanded]     = useState<number | null>(null)
  const [checking, setChecking]     = useState<number | null>(null)
  const [starting, setStarting]     = useState<number | null>(null)
  const [results, setResults]       = useState<Record<number, CheckResult>>({})
  const [err, setErr]               = useState('')
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast()

  const toggleExpand = (id: number) => setExpanded(prev => prev === id ? null : id)

  const handleCheck = async (piId: number) => {
    setChecking(piId); setErr('')
    try {
      const res = await api.checkPIMaterials(piId)
      setResults(prev => ({ ...prev, [piId]: res }))
      refetch()
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi kiểm tra vật tư')
    } finally {
      setChecking(null)
    }
  }

  const handleStart = async (piId: number) => {
    setStarting(piId); setErr('')
    try {
      await api.startProducingPI(piId)
      refetch()
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi cập nhật trạng thái')
    } finally {
      setStarting(null)
    }
  }

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', padding: 24, display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  const handleProposalCreated = (code: string, piCode: string) => {
    refetch()
    pushToast(
      `Đã gửi đề xuất ${code} đến Kho`,
      `Từ Lệnh SX ${piCode} — Thủ kho sẽ xem xét và trình Giám đốc duyệt.`,
    )
  }

  const counts = {
    NEW:        pis.filter(p => p.status === 'NEW').length,
    PLANNING:   pis.filter(p => p.status === 'PLANNING').length,
    PURCHASING: pis.filter(p => p.status === 'PURCHASING').length,
    PRODUCING:  pis.filter(p => p.status === 'PRODUCING').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Kế hoạch sản xuất</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Kiểm vật tư + theo dõi trạng thái từng lệnh SX trước khi bước vào sản xuất.
          </p>
        </div>
        <button onClick={refetch} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Thống kê nhanh */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Mới', count: counts.NEW, color: '#666', bg: '#f5f5f5' },
          { label: 'Lập kế hoạch', count: counts.PLANNING, color: '#1565c0', bg: '#e3f2fd' },
          { label: 'Đang mua vật tư', count: counts.PURCHASING, color: '#e65100', bg: '#fff3e0' },
          { label: 'Đang sản xuất', count: counts.PRODUCING, color: '#2e7d32', bg: '#e8f5e9' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: s.bg, borderRadius: 'var(--radius-lg)', minWidth: 140 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</span>
            <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {err && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      {pis.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 14 }}>
          Không có lệnh SX nào đang trong kế hoạch.
        </div>
      )}

      <ToastStack toasts={toasts} dismiss={dismissToast} />

      {/* Bảng PI */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }} />
              <th style={th}>Lệnh SX</th>
              <th style={th}>Sản phẩm</th>
              <th style={th}>Deadline</th>
              <th style={th}>Hạn vật tư</th>
              <th style={th}>Trạng thái</th>
              <th style={th}>LMH</th>
              <th style={{ ...th, textAlign: 'center' }}>Vật tư</th>
              <th style={{ ...th, textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pis.map(pi => {
              const isOpen    = expanded === pi.id
              const c         = PI_STATUS_COLOR[pi.status] ?? { bg: '#f5f5f5', text: '#666', border: '#ddd' }
              const result    = results[pi.id]
              const isChecking = checking === pi.id
              const isStarting = starting === pi.id
              const deadlineDate = new Date(pi.deadline)
              const matDate      = new Date(pi.materialDeadline)
              const now = new Date()
              const matOverdue   = matDate < now
              const dedOverdue   = deadlineDate < now

              return [
                // ── Dòng chính ──
                <tr key={pi.id} style={{ cursor: 'pointer', background: isOpen ? 'var(--surface2)' : undefined }}
                  onClick={() => toggleExpand(pi.id)}>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--text3)', width: 28 }}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{pi.code}</span>
                    {pi.poNumber && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>PO: {pi.poNumber}</div>}
                    {pi.exportCustomerName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pi.exportCustomerName}</div>}
                  </td>
                  <td style={td}>
                    {pi.products.map((p, i) => (
                      <div key={i} style={{ fontSize: 13 }}>
                        <strong>{p.name}</strong>
                        {p.colorCode && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({p.colorCode})</span>}
                        <span style={{ marginLeft: 6, color: 'var(--text3)' }}>×{p.quantity} bộ</span>
                      </div>
                    ))}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <span style={{ color: dedOverdue ? '#c62828' : undefined, fontWeight: dedOverdue ? 700 : undefined }}>
                      {format(deadlineDate, 'dd/MM/yyyy')}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <span style={{ color: matOverdue ? '#e65100' : undefined, fontSize: 12 }}>
                      {format(matDate, 'dd/MM/yyyy')}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      {PI_STATUS_LABEL[pi.status] ?? pi.status}
                    </span>
                  </td>
                  <td style={td}>
                    {pi.lmh ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{pi.lmh.code}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{LMH_STATUS_LABEL[pi.lmh.status] ?? pi.lmh.status}</div>
                      </div>
                    ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    {!pi.lmh ? (
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                    ) : !pi.lmh.hasComputed ? (
                      <span style={{ fontSize: 12, color: '#e65100' }}>Chưa kiểm</span>
                    ) : pi.lmh.missingCount === 0 ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: '#2e7d32', fontSize: 12, fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> Đủ vật tư
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: '#e65100', fontSize: 12, fontWeight: 600 }}>
                        <ShoppingCart size={14} /> Thiếu {pi.lmh.missingCount} loại
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleCheck(pi.id)}
                        disabled={isChecking}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, cursor: isChecking ? 'not-allowed' : 'pointer', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {isChecking ? <Loader2 size={12} className="spin" /> : <PackageSearch size={12} />}
                        Kiểm vật tư
                      </button>
                      {pi.status === 'PURCHASING' && (
                        <button
                          onClick={() => handleStart(pi.id)}
                          disabled={isStarting}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', fontSize: 12, cursor: isStarting ? 'not-allowed' : 'pointer', color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {isStarting ? <Loader2 size={12} /> : <PlayCircle size={12} />}
                          Bắt đầu SX
                        </button>
                      )}
                    </div>
                  </td>
                </tr>,

                // ── Panel mở rộng ──
                isOpen && (
                  <tr key={`${pi.id}-detail`}>
                    <td colSpan={9} style={{ padding: 0, background: 'var(--surface2)' }}>
                      <div style={{ padding: '14px 20px 14px 44px', borderTop: '1px solid var(--border)' }}>
                        {result ? (
                          <ShortageDetail result={result} piId={pi.id} piCode={pi.code} activeProposal={pi.activeProposal} onProposalCreated={handleProposalCreated} />
                        ) : (
                          <PlanningSteps pi={pi} onCheck={() => handleCheck(pi.id)} isChecking={isChecking} />
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Bước kế hoạch khi chưa kiểm vật tư ───────────────────────────────────────
function PlanningSteps({ pi, onCheck, isChecking }: { pi: PlanningPI; onCheck: () => void; isChecking: boolean }) {
  const steps = [
    { label: 'Tạo lệnh SX', done: true,            icon: <CheckCircle2 size={16} color="#2e7d32" /> },
    { label: 'Kiểm vật tư', done: pi.lmh?.hasComputed ?? false, icon: pi.lmh?.hasComputed ? <CheckCircle2 size={16} color="#2e7d32" /> : <Clock size={16} color="#e65100" /> },
    { label: 'Mua hàng',    done: pi.lmh?.missingCount === 0,   icon: pi.lmh?.missingCount === 0 ? <CheckCircle2 size={16} color="#2e7d32" /> : <Clock size={16} color="#aaa" /> },
    { label: 'Sản xuất',    done: ['PRODUCING', 'DONE'].includes(pi.status), icon: ['PRODUCING', 'DONE'].includes(pi.status) ? <CheckCircle2 size={16} color="#2e7d32" /> : <Clock size={16} color="#aaa" /> },
  ]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {s.icon}
              <span style={{ fontSize: 11, color: s.done ? '#2e7d32' : 'var(--text3)', fontWeight: s.done ? 600 : 400, whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 48, height: 2, background: s.done ? '#a5d6a7' : 'var(--border)', margin: '0 6px', marginBottom: 16 }} />
            )}
          </div>
        ))}
      </div>
      {!pi.lmh?.hasComputed && (
        <button onClick={onCheck} disabled={isChecking}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: isChecking ? 'not-allowed' : 'pointer' }}>
          {isChecking ? <Loader2 size={14} /> : <PackageSearch size={14} />}
          Kiểm tra vật tư ngay
        </button>
      )}
    </div>
  )
}

// ── Kết quả kiểm vật tư ───────────────────────────────────────────────────────
function ShortageDetail({ result, piId, piCode, activeProposal, onProposalCreated }: {
  result: CheckResult
  piId: number
  piCode: string
  activeProposal: { id: number; code: string; status: string } | null
  onProposalCreated: (code: string, piCode: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [proposingSpec, setProposingSpec] = useState(false)
  const [specErr, setSpecErr] = useState('')
  // Nếu PI đã có active proposal → hiện ngay, không cho tạo thêm
  const [proposalCode, setProposalCode] = useState<string | null>(activeProposal?.code ?? null)
  const [propErr, setPropErr] = useState('')

  const handleCreateProposal = async () => {
    setCreating(true); setPropErr('')
    try {
      const res = await api.createProposalFromPI(piId)
      setProposalCode(res.code)
      onProposalCreated(res.code, piCode)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi tạo đề xuất'
      setPropErr(msg)
    } finally {
      setCreating(false)
    }
  }

  const handleProposeSpec = async () => {
    setProposingSpec(true); setSpecErr('')
    try {
      await api.createSpecEntryProposal({ piId, piCode })
      setProposingSpec(false)
      onProposalCreated(`DEF-${piId}`, piCode)
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi tạo đề xuất định mức'
      setSpecErr(msg)
    } finally {
      setProposingSpec(false)
    }
  }

  if (result.shortages.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2e7d32', fontWeight: 600, fontSize: 14 }}>
        <CheckCircle2 size={18} />
        Đủ vật tư — lệnh SX có thể bắt đầu sản xuất ngay.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e65100', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
        <ShoppingCart size={16} />
        Thiếu {result.shortages.length} loại vật tư — cần mua thêm trước khi sản xuất:
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
        <thead>
          <tr>
            {['Vật tư', 'Cần', 'Tồn kho', 'Cần mua'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 16px 4px 0', fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.shortages.map((s, i) => (
            <tr key={i}>
              <td style={{ padding: '5px 16px 5px 0', fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '5px 16px 5px 0', color: 'var(--text2)' }}>{s.required.toLocaleString('vi-VN')} {s.unit}</td>
              <td style={{ padding: '5px 16px 5px 0', color: s.stock > 0 ? '#2e7d32' : 'var(--text3)' }}>{s.stock.toLocaleString('vi-VN')} {s.unit}</td>
              <td style={{ padding: '5px 0', fontWeight: 700, color: '#e65100' }}>{s.buyQty.toLocaleString('vi-VN')} {s.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {proposalCode ? (
        /* Badge xác nhận — kể cả khi đã có từ trước lần này */
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          <CheckCircle2 size={18} color="#2e7d32" />
          <div>
            <div style={{ fontWeight: 700, color: '#1b5e20' }}>
              Đề xuất <span style={{ fontFamily: 'monospace' }}>{proposalCode}</span> đã gửi sang Mua hàng
            </div>
            <div style={{ fontSize: 12, color: '#388e3c', marginTop: 2 }}>
              LMH tự động tạo — NV Mua hàng đang xử lý
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: propErr ? 8 : 0 }}>
            <button
              onClick={handleCreateProposal}
              disabled={creating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#4527a0', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? .7 : 1 }}
            >
              {creating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {creating ? 'Đang tạo…' : 'Tạo đề xuất mua → Kho'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              Thủ kho xem → Giám đốc duyệt → LMH tự tạo → Mua hàng
            </span>
          </div>
          {propErr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#c62828', padding: '8px 12px', background: '#ffebee', borderRadius: 'var(--radius)', border: '1px solid #ef9a9a' }}>
              <AlertCircle size={14} /> {propErr}
            </div>
          )}
        </div>
      )}

      {/* Đề xuất nhập định mức */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1565c0', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          <PackageSearch size={16} />
          Đề xuất nhập định mức cho các NV (4 nhiệm vụ):
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: specErr ? 8 : 0 }}>
          <button
            onClick={handleProposeSpec}
            disabled={proposingSpec}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, cursor: proposingSpec ? 'not-allowed' : 'pointer', opacity: proposingSpec ? .7 : 1 }}
          >
            {proposingSpec ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FilePlus size={14} />}
            {proposingSpec ? 'Đang tạo…' : 'Gửi đề xuất định mức'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            Tạo 4 task cho NV Sắt/Dây-Sơn/Phụ kiện/Bao bì
          </span>
        </div>
        {specErr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#c62828', padding: '8px 12px', background: '#ffebee', borderRadius: 'var(--radius)', border: '1px solid #ef9a9a' }}>
            <AlertCircle size={14} /> {specErr}
          </div>
        )}
      </div>
    </div>
  )
}
