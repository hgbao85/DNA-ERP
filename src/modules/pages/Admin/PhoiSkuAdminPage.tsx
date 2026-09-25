'use client'

/**
 * "Sửa SKU đợt Phôi" (2026-09-21) - cửa "sửa sai" của ADMIN cho việc gán SKU cho đợt Phôi.
 *
 * Bối cảnh: từ 2026-09-21 mỗi đợt Cắt / công đoạn phụ (Uốn, Dập...) của Phôi thuộc đúng 1 SKU. Đợt CŨ chưa có SKU
 * thì Phôi tự gán 1 lần ở màn Lệnh sản xuất Phôi; nếu gán nhầm, Phôi KHÔNG sửa lại được - chỉ ADMIN sửa ở đây
 * (route BE reassign-order chặn @RequireRole(ADMIN), ghi audit log mọi lần đổi). Đặt trong AdminApp vì ADMIN không
 * vào được giao diện Sản xuất (xem app/page.tsx).
 *
 * Lịch sử đổi hiện ngay dưới bảng, đọc từ audit log THẬT (GET /audit-logs) - trang "Nhật ký hoạt động" chung của
 * Admin vẫn đọc mockStore nên KHÔNG hiện các dòng này.
 */
import { useMemo, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { getAuditLogsByTable, type BeAuditLogEntry } from '../../../services/audit-log-api'
import type { BeCutBundle, BeStepBundle, BeSteelIssue, BePiOrderSummary } from '../../../services/steel-issues-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#3949ab'
const RED = '#c62828'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', background: 'var(--surface2)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' }

interface BundleRow {
  key: string
  kind: 'cut' | 'step'
  id: string
  stepLabel: string
  materialName: string
  segments: string
  at: string
  status: string
  orderId: string | null
}

const STATUS_LABEL: Record<string, string> = { CUTTING: 'đang cắt', AWAITING_QC: 'chờ KCS', QC_PASSED: 'đã duyệt' }

export default function PhoiSkuAdminPage() {
  const { data: pis, isLoading } = useFetch(() => api.getProductionInvoices(), [])
  const [piId, setPiId] = useState('')

  const multi = useMemo(() => (pis ?? []).filter(p => p.items.length > 1), [pis])
  const others = useMemo(() => (pis ?? []).filter(p => p.items.length <= 1), [pis])

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sửa SKU đợt Phôi</h2>
      <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--text3)', maxWidth: 760 }}>
        Mỗi đợt Cắt / Uốn / Dập… của Phôi thuộc đúng 1 SKU. Đợt cũ chưa có SKU do Phôi tự gán (1 lần); nếu gán nhầm, chỉ Quản trị viên sửa được tại đây.
        Mọi lần đổi đều được ghi lại (ai, lúc nào, từ SKU nào sang SKU nào). Chỉ PI có từ 2 SKU trở lên mới cần sửa.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Chọn PI:</span>
        <select value={piId} onChange={e => setPiId(e.target.value)} disabled={isLoading} style={{ padding: '6px 10px', fontSize: 13, flex: 1, minWidth: 0, maxWidth: 360 }}>
          <option value="">{isLoading ? 'Đang tải…' : '— Chọn PI —'}</option>
          {multi.length > 0 && (
            <optgroup label="PI có từ 2 SKU">
              {multi.map(p => <option key={p.id} value={p.id}>{p.code} ({p.items.length} SKU)</option>)}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="PI 1 SKU (không cần sửa)">
              {others.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {piId ? <PiPanel key={piId} piId={piId} /> : (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chọn một PI để xem các đợt Phôi và SKU của từng đợt</div>
      )}
    </div>
  )
}

function PiPanel({ piId }: { piId: string }) {
  const { data: orders } = useFetch<BePiOrderSummary[]>(() => api.getPiOrderSummary(piId), [piId])
  const { data: issues } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesForInvoice(piId), [piId])
  const { data: cuts, refetch: refetchCuts } = useFetch<BeCutBundle[]>(() => api.getAllCutBundles(piId), [piId])
  const { data: steps, refetch: refetchSteps } = useFetch<BeStepBundle[]>(() => api.getStepBundlesForInvoice(piId), [piId])
  const { data: users } = useFetch(() => api.getUsers().catch(() => []), [])
  const { data: cutLogs, refetch: refetchCutLogs } = useFetch<BeAuditLogEntry[]>(() => getAuditLogsByTable('CutBundle'), [])
  const { data: stepLogs, refetch: refetchStepLogs } = useFetch<BeAuditLogEntry[]>(() => getAuditLogsByTable('StepBundle'), [])
  const [pending, setPending] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const orderList = orders ?? []
  const labelOf = (id: string | null) => {
    if (!id) return 'Chưa phân SKU'
    const o = orderList.find(x => x.productionOrderId === id)
    return o ? `${o.poNumber} · ${o.sku}` : `SKU ${id}`
  }

  const rows: BundleRow[] = useMemo(() => {
    const matBySteel = new Map((issues ?? []).map(i => [i.id, i.materialName]))
    const fmt = (segs: { cutLengthMm: number; qty: number }[]) => segs.map(s => `${s.qty}×${s.cutLengthMm.toLocaleString('vi-VN')}mm`).join(' + ')
    const cutRows: BundleRow[] = (cuts ?? []).map(b => ({
      key: `cut:${b.id}`, kind: 'cut', id: b.id, stepLabel: 'Cắt', materialName: matBySteel.get(b.steelIssueId) ?? '—',
      segments: fmt(b.segments), at: b.completedAt ?? b.createdAt, status: STATUS_LABEL[b.status] ?? b.status, orderId: b.productionOrderId,
    }))
    const stepRows: BundleRow[] = (steps ?? []).map(b => ({
      key: `step:${b.id}`, kind: 'step', id: b.id, stepLabel: PROCESS_STEP_LABELS[b.step], materialName: b.materialName,
      segments: fmt(b.segments), at: b.submittedAt, status: STATUS_LABEL[b.status] ?? b.status, orderId: b.productionOrderId,
    }))
    return [...cutRows, ...stepRows].sort((a, b) => a.at.localeCompare(b.at))
  }, [cuts, steps, issues])

  const nameByUser = useMemo(() => new Map((users ?? []).map((u: { id: string | number; name: string }) => [String(u.id), u.name])), [users])
  const history = useMemo(() => {
    const cutIds = new Set((cuts ?? []).map(b => b.id))
    const stepIds = new Set((steps ?? []).map(b => b.id))
    const mine = [
      ...(cutLogs ?? []).filter(l => cutIds.has(l.recordId)).map(l => ({ ...l, label: 'Cắt' })),
      ...(stepLogs ?? []).filter(l => stepIds.has(l.recordId)).map(l => ({ ...l, label: 'Công đoạn phụ' })),
    ]
    return mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [cutLogs, stepLogs, cuts, steps])

  const change = async (r: BundleRow) => {
    const target = pending[r.key]
    const o = orderList.find(x => x.productionOrderId === target)
    if (!o) return
    if (!window.confirm(`Đổi đợt ${r.stepLabel} (${r.materialName}) từ ${labelOf(r.orderId)} sang ${o.poNumber} · ${o.sku}?\nViệc đổi được ghi lại (ai, lúc nào).`)) return
    setBusyKey(r.key); setErr('')
    try {
      if (r.kind === 'cut') await api.reassignCutBundleOrder(r.id, target)
      else await api.reassignStepBundleOrder(r.id, target)
      setPending(p => { const n = { ...p }; delete n[r.key]; return n })
      refetchCuts(); refetchSteps(); refetchCutLogs(); refetchStepLogs()
    } catch (e) { setErr(errMsg(e, 'Không đổi được SKU')) }
    finally { setBusyKey(null) }
  }

  if (!orders || !cuts || !steps) return <LoadingState />

  return (
    <div>
      {orderList.length <= 1 && (
        <div style={{ ...card, padding: 14, marginBottom: 14, fontSize: 13, color: 'var(--text3)' }}>PI này chỉ có {orderList.length} SKU — mọi đợt tự tính cho SKU đó, không cần sửa.</div>
      )}
      {err && <div style={{ marginBottom: 10, fontSize: 13, color: RED, fontWeight: 600 }}>{err}</div>}

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Các đợt Phôi ({rows.length})</div>
      {/* Sàn minWidth: trên điện thoại bảng cuộn ngang trong khung thay vì bóp 7 cột tới mức chữ vỡ từng từ. */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Công đoạn</th><th style={th}>Loại sắt</th><th style={th}>Đợt</th><th style={th}>Lúc</th><th style={th}>Trạng thái</th><th style={th}>SKU hiện tại</th><th style={th}>Sửa SKU</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td style={{ ...td, fontWeight: 700 }}>{r.stepLabel}</td>
                <td style={td}>{r.materialName}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{r.segments}</td>
                <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString('vi-VN')}</td>
                <td style={td}>{r.status}</td>
                <td style={{ ...td, fontWeight: 600, color: r.orderId ? 'var(--text)' : 'var(--text3)' }}>{labelOf(r.orderId)}</td>
                <td style={td}>
                  {orderList.length <= 1 ? <span style={{ color: 'var(--text3)' }}>—</span>
                    : !r.orderId ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>Chờ Phôi gán</span>
                    : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={pending[r.key] ?? ''} onChange={e => setPending(p => ({ ...p, [r.key]: e.target.value }))} style={{ padding: '4px 6px', fontSize: 12 }}>
                          <option value="">Chọn SKU mới…</option>
                          {orderList.filter(o => o.productionOrderId !== r.orderId).map(o => <option key={o.productionOrderId} value={o.productionOrderId}>{o.poNumber} · {o.sku}</option>)}
                        </select>
                        <button onClick={() => change(r)} disabled={!pending[r.key] || busyKey === r.key}
                          style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: !pending[r.key] || busyKey === r.key ? 'not-allowed' : 'pointer', opacity: !pending[r.key] ? 0.5 : 1 }}>
                          {busyKey === r.key ? '...' : 'Đổi'}
                        </button>
                      </div>
                    )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">PI này chưa có đợt Phôi nào</div></td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 8px' }}>Lịch sử đổi SKU ({history.length})</div>
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Lúc</th><th style={th}>Người đổi</th><th style={th}>Đợt</th><th style={th}>Từ SKU</th><th style={th}>Sang SKU</th><th style={th}>Loại</th></tr></thead>
          <tbody>
            {history.map(h => {
              const oldId = (h.oldValue as { productionOrderId?: string | null } | null)?.productionOrderId ?? null
              const nv = h.newValue as { productionOrderId?: string; reassign?: boolean } | null
              return (
                <tr key={h.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString('vi-VN')}</td>
                  <td style={td}>{h.userId ? (nameByUser.get(h.userId) ?? 'Người dùng đã xoá') : 'Hệ thống'}</td>
                  <td style={td}>{h.label} #{h.recordId}</td>
                  <td style={td}>{labelOf(oldId)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{labelOf(nv?.productionOrderId ?? null)}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{nv?.reassign ? 'Admin sửa' : 'Phôi gán'}</td>
                </tr>
              )
            })}
            {history.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg">Chưa có lần gán/sửa SKU nào</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
