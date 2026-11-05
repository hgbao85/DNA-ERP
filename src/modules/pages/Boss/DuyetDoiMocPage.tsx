'use client'
// Phần A – Đợt 9 (YC2): màn Sếp duyệt đổi mốc lệnh SX. KHSX sửa mốc lệnh đã duyệt (sửa tay / Excel) -> 1 lô chờ Sếp;
// xưởng vẫn chạy theo mốc cũ tới khi Sếp duyệt. Sếp duyệt -> mốc mới có hiệu lực + báo Mua hàng, QLSX, Kho; từ chối -> giữ mốc cũ,
// KHSX nhận lý do. FE chỉ trình bày + gửi quyết định; BE tính hết (cảnh báo, kiểm mốc đã đổi từ lúc gửi...). Không hiện mã PI.
import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useWorkQueue } from '../../../context/WorkQueueContext'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import {
  DEADLINE_PARTIAL_APPROVAL,
  decideDeadlineChangeBatch,
  getDeadlineChangeBatches,
  type DeadlineChangeBatchDto,
  type DeadlineChangeRequestDto,
} from '../../../services/deadline-changes-api'
import ConfirmModal from '../../../components/ConfirmModal'
import EmptyState from '../../../components/EmptyState'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import ReasonModal from '../../../components/ReasonModal'
import RefreshButton from '../../../components/RefreshButton'
import { th, td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'
import {
  changeText, confirmApproveText, fmtDateTimeVN, pendingRequests, planApprove, planRejectAll, reasonValid, resultMessage, skuCount,
  sortOldestFirst, sourceLabel, statusText, MIN_REASON_LENGTH, type DecisionPlan,
} from './duyetDoiMoc'

type View = 'PENDING' | 'DECIDED'

const AMBER_BOX: React.CSSProperties = { background: 'var(--amber-bg)', color: 'var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600 }

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400, borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--fg-2e7d32)' : 'var(--border)'}`,
    background: active ? 'var(--bg-e8f5e9)' : 'var(--surface)', color: active ? 'var(--fg-2e7d32)' : 'var(--text2)',
  }
}

function ChangesCell({ r }: { r: DeadlineChangeRequestDto }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {r.changes.map(c => <div key={c.key} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{changeText(c)}</div>)}
    </div>
  )
}

function WarningsCell({ r }: { r: DeadlineChangeRequestDto }) {
  if (r.warnings.length === 0) return <span style={{ color: 'var(--text3)' }}>-</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {r.warnings.map((w, i) => <span key={i} style={AMBER_BOX}>{w}</span>)}
    </div>
  )
}

function SkuCell({ r }: { r: DeadlineChangeRequestDto }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{r.skuCode}</div>
      {r.skuName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.skuName}</div>}
    </div>
  )
}

/** Mô tả quyết định của yêu cầu đã chốt (chế độ chỉ xem). */
function DecidedCell({ r, batch }: { r: DeadlineChangeRequestDto; batch: DeadlineChangeBatchDto }) {
  const color = r.status === 'APPROVED' ? 'var(--fg-2e7d32)' : r.status === 'REJECTED' ? 'var(--fg-c62828)' : 'var(--text3)'
  return (
    <div>
      <div style={{ fontWeight: 600, color }}>{statusText(r.status)}</div>
      {r.status === 'REJECTED' && r.rejectReason && <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Lý do: {r.rejectReason}</div>}
      {batch.decidedBy && r.status !== 'CANCELLED' && (
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{batch.decidedBy.name} · {fmtDateTimeVN(batch.decidedAt)}</div>
      )}
    </div>
  )
}

function BatchBlock({ batch, readOnly, onDone }: { batch: DeadlineChangeBatchDto; readOnly: boolean; onDone: (msg: string) => void }) {
  const isMobile = useIsMobile()
  const pending = useMemo(() => pendingRequests(batch), [batch])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.map(r => r.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<DecisionPlan | null>(null)
  const [reason, setReason] = useState('')

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allChosen = pending.length > 0 && pending.every(r => selected.has(r.id))
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(pending.map(r => r.id)))

  const approvePlan = planApprove(batch, selected, DEADLINE_PARTIAL_APPROVAL)
  const canApprove = approvePlan.approveCount > 0 && pending.length > 0

  const close = () => { if (!busy) { setPlan(null); setReason(''); setError(null) } }
  const submit = async () => {
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      await decideDeadlineChangeBatch(batch.id, { approveRequestIds: plan.approveRequestIds, ...(plan.needsReason ? { rejectReason: reason.trim() } : {}) })
      const msg = resultMessage(plan)
      setPlan(null)
      setReason('')
      onDone(msg)
    } catch (e) {
      // 409 (mốc đã đổi từ lúc gửi) và mọi lỗi BE khác: hiện nguyên câu BE, hộp vẫn mở.
      setError(errMsg(e, 'Không quyết được lô này'))
    } finally {
      setBusy(false)
    }
  }

  const showCheck = !readOnly && DEADLINE_PARTIAL_APPROVAL
  const colSpanHeads = ['Lệnh', 'SKU', 'SL', 'Mốc đổi', readOnly ? 'Kết quả' : 'Cảnh báo']

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text2)' }}>{sourceLabel(batch.source)}</span>
        <span style={{ fontSize: 13 }}>Người gửi: <b>{batch.requestedBy.name}</b></span>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Lúc gửi: {fmtDateTimeVN(batch.requestedAt)}</span>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{skuCount(batch)} SKU</span>
        {batch.note && <span style={{ fontSize: 12, color: 'var(--text3)', flexBasis: '100%' }}>Ghi chú: {batch.note}</span>}
        {readOnly && batch.decisionNote && <span style={{ fontSize: 12, color: 'var(--text2)', flexBasis: '100%' }}>Lý do Sếp ghi: {batch.decisionNote}</span>}
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {batch.requests.map(r => (
            <div key={r.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {showCheck && r.status === 'PENDING' && (
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Chọn ${r.lenhCode} ${r.skuCode}`} style={{ marginTop: 4, width: 18, height: 18 }} />
              )}
              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)' }}>{r.lenhCode}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <SkuCell r={r} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>×{r.quantity.toLocaleString('vi-VN')}</span>
                </div>
                <ChangesCell r={r} />
                {readOnly ? <DecidedCell r={r} batch={batch} /> : r.warnings.length > 0 && <WarningsCell r={r} />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...tableWrap, border: 'none', borderRadius: 0 }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                {showCheck && (
                  <th style={{ ...th, width: 36 }}>
                    <input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label="Chọn hết" />
                  </th>
                )}
                {colSpanHeads.map(h => <th key={h} style={{ ...th, textAlign: h === 'SL' ? 'right' : 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {batch.requests.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                  {showCheck && (
                    <td style={td}>
                      {r.status === 'PENDING' && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Chọn ${r.lenhCode} ${r.skuCode}`} />}
                    </td>
                  )}
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)', whiteSpace: 'nowrap' }}>{r.lenhCode}</td>
                  <td style={td}><SkuCell r={r} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.quantity.toLocaleString('vi-VN')}</td>
                  <td style={td}><ChangesCell r={r} /></td>
                  <td style={td}>{readOnly ? <DecidedCell r={r} batch={batch} /> : <WarningsCell r={r} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && (
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
          {DEADLINE_PARTIAL_APPROVAL && pending.length > 1 && (
            <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 'auto' }}>
              Đã chọn {approvePlan.approveCount}/{pending.length}. Yêu cầu bỏ chọn sẽ bị từ chối (phải ghi lý do).
            </span>
          )}
          <button
            onClick={() => setPlan(planRejectAll(batch))}
            disabled={busy || pending.length === 0}
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--fg-c62828)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--fg-c62828)', cursor: 'pointer' }}
          >
            Từ chối…
          </button>
          <button
            onClick={() => setPlan(approvePlan)}
            disabled={busy || !canApprove}
            style={{ padding: '8px 18px', background: 'var(--bg-2e7d32)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: canApprove ? 'pointer' : 'not-allowed', opacity: canApprove ? 1 : 0.6 }}
          >
            Duyệt ({approvePlan.approveCount})
          </button>
        </div>
      )}

      {/* Từ chối (cả lô) hoặc duyệt có bỏ chọn bớt: phải có lý do. */}
      <ReasonModal
        open={!!plan && plan.needsReason}
        title={plan && plan.approveCount > 0 ? `Duyệt ${plan.approveCount}, từ chối ${plan.rejectCount} yêu cầu` : 'Từ chối đổi mốc'}
        description={plan && plan.approveCount > 0
          ? `${plan.rejectCount} yêu cầu bỏ chọn sẽ bị từ chối và giữ mốc cũ. Nhập lý do để Kế hoạch SX biết (ít nhất ${MIN_REASON_LENGTH} ký tự).`
          : `Cả lô giữ mốc cũ, xưởng chạy như trước. Nhập lý do để Kế hoạch SX biết (ít nhất ${MIN_REASON_LENGTH} ký tự).`}
        reason={reason}
        onReasonChange={setReason}
        placeholder="Lý do từ chối (bắt buộc)..."
        onCancel={close}
        onConfirm={submit}
        confirmLabel={plan && plan.approveCount > 0 ? 'Xác nhận' : 'Xác nhận từ chối'}
        confirmColor={plan && plan.approveCount > 0 ? 'var(--bg-2e7d32)' : 'var(--fg-c62828)'}
        confirmDisabled={!reasonValid(reason)}
        busy={busy}
        error={error}
      />
      {/* Duyệt hết: xác nhận ngắn. */}
      <ConfirmModal
        open={!!plan && !plan.needsReason}
        title="Duyệt đổi mốc"
        message={plan ? confirmApproveText(plan) : ''}
        confirmLabel="Duyệt"
        busy={busy}
        error={error}
        onConfirm={submit}
        onCancel={close}
      />
    </div>
  )
}

export default function DuyetDoiMocPage() {
  const [view, setView] = useState<View>('PENDING')
  const [notice, setNotice] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useFetch(() => getDeadlineChangeBatches({ status: view }), [view])

  const batches = useMemo(() => {
    const list = data ?? []
    // Chờ duyệt: cũ nhất trước. Đã quyết: mới quyết trước.
    return view === 'PENDING' ? sortOldestFirst(list) : [...list].sort((a, b) => new Date(b.decidedAt ?? b.requestedAt).getTime() - new Date(a.decidedAt ?? a.requestedAt).getTime())
  }, [data, view])

  // Quyết xong: tải lại danh sách + số nhắc việc trên menu ngay (không chờ lượt poll).
  const { refresh: refreshWorkQueue } = useWorkQueue()
  const done = (msg: string) => { setNotice(msg); refetch(); void refreshWorkQueue() }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => { setView('PENDING'); setNotice(null) }} style={pillStyle(view === 'PENDING')}>Chờ duyệt</button>
        <button onClick={() => { setView('DECIDED'); setNotice(null) }} style={pillStyle(view === 'DECIDED')}>Đã quyết</button>
        <span style={{ flex: 1 }} />
        <RefreshButton onRefresh={refetch} loading={isLoading} />
      </div>
      {view === 'PENDING' && (
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text3)' }}>
          Lệnh đã duyệt mà Kế hoạch SX xin đổi mốc. Trong lúc chờ, xưởng vẫn chạy theo mốc cũ.
        </p>
      )}
      {notice && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13, fontWeight: 500 }}>{notice}</div>
      )}

      {error && !data ? (
        <LoadErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingState />
      ) : batches.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={28} style={{ opacity: 0.4, marginBottom: 8 }} />}
          message={view === 'PENDING' ? 'Không có lô đổi mốc nào chờ duyệt.' : 'Chưa có lô đổi mốc nào đã quyết.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <LoadErrorState error={error} onRetry={refetch} />}
          {batches.map(b => <BatchBlock key={`${b.id}:${b.requests.map(r => r.id + r.status).join(',')}`} batch={b} readOnly={view === 'DECIDED'} onDone={done} />)}
        </div>
      )}
    </div>
  )
}
