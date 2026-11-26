'use client'
// Huỷ lệnh theo SKU - đợt 1 (23/11/2026, anh Nhân trả lời 7 câu): Sếp duyệt / từ chối đề nghị huỷ 1 SKU của KHSX. Duyệt: lệnh SX của
// SKU dừng hẳn (xưởng hết thấy), KCS chấm nốt, đoạn đã cắt vào dư kho Phôi, hàng đóng gói / khung đan KHSX chuyển sang đơn khác, dòng đơn bán về "chưa lên lệnh" để lên lệnh lại, dòng mua
// chưa ký tự giảm, dòng đã ký: người mua liên hệ NCC. BE kiểm hết (đã giao hàng, còn nằm trong booking...). Không hiện mã PI.
import { useState } from 'react'
import { Ban } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useWorkQueue } from '../../../context/WorkQueueContext'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  decideOrderCancel,
  getOrderCancelRequests,
  type OrderCancelRequestDto,
  type OrderCancelStatus,
} from '../../../services/order-cancellations-api'
import Modal from '../../../components/Modal'
import CancelImpactPanel from './CancelImpactPanel'
import EmptyState from '../../../components/EmptyState'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import ReasonModal from '../../../components/ReasonModal'
import RefreshButton from '../../../components/RefreshButton'
import { th, td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'
import { fmtDateTimeVN } from './duyetDoiMoc'

type View = 'PENDING' | 'DECIDED'

const STATUS_TEXT: Record<OrderCancelStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt huỷ',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'KHSX đã rút lại',
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400, borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--fg-2e7d32)' : 'var(--border)'}`,
    background: active ? 'var(--bg-e8f5e9)' : 'var(--surface)', color: active ? 'var(--fg-2e7d32)' : 'var(--text2)',
  }
}

const lenhOf = (r: OrderCancelRequestDto) => r.lenhCode ?? r.lsxCode ?? r.poNumber

export default function DuyetHuyLenhPage() {
  const [view, setView] = useState<View>('PENDING')
  const [notice, setNotice] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useFetch(
    async () => {
      if (view === 'PENDING') return getOrderCancelRequests({ status: 'PENDING' })
      const all = await getOrderCancelRequests()
      return all.filter(r => r.status !== 'PENDING')
    },
    [view],
  )
  useRealtimeRefetch(['production-orders'], refetch)
  const { refresh: refreshWorkQueue } = useWorkQueue()

  const [approveTarget, setApproveTarget] = useState<OrderCancelRequestDto | null>(null)
  const [rejectTarget, setRejectTarget] = useState<OrderCancelRequestDto | null>(null)
  // Câu 8: xem lại ảnh hưởng của đề nghị đã quyết (số chụp lúc duyệt).
  const [viewTarget, setViewTarget] = useState<OrderCancelRequestDto | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const closeModals = () => { setApproveTarget(null); setRejectTarget(null); setReason(''); setActionError(null) }
  const decide = async (r: OrderCancelRequestDto, approve: boolean) => {
    setBusy(true)
    setActionError(null)
    try {
      await decideOrderCancel(r.id, approve ? { approve: true } : { approve: false, note: reason.trim() })
      closeModals()
      setNotice(approve
        ? `Đã duyệt huỷ lệnh ${lenhOf(r)} (${r.factoryCode}). SKU đã về "chưa lên lệnh".`
        : `Đã từ chối huỷ lệnh ${lenhOf(r)} - lệnh chạy tiếp.`)
      refetch()
      void refreshWorkQueue()
    } catch (e) {
      setActionError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const rows = data ?? []

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
          Kế hoạch SX xin huỷ SKU của lệnh đã duyệt. Duyệt thì xưởng dừng làm SKU đó (KCS chấm nốt đợt đã báo), đoạn đã cắt vào dư kho
          Phôi, hàng đã đóng gói Kế hoạch SX chuyển sang đơn khác được, khung đã đan vào tồn kho Thành phẩm cho lệnh sau cùng mảnh + màu dây
          tự lấy, SKU về &quot;chưa lên lệnh&quot; để lên lệnh lại.
        </p>
      )}
      {notice && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 13, fontWeight: 500 }}>{notice}</div>
      )}

      {error && !data ? (
        <LoadErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Ban size={28} style={{ opacity: 0.4, marginBottom: 8 }} />}
          message={view === 'PENDING' ? 'Không có đề nghị huỷ lệnh nào chờ duyệt.' : 'Chưa có đề nghị huỷ lệnh nào đã quyết.'}
        />
      ) : (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Lệnh</th>
                <th style={th}>SKU</th>
                <th style={{ ...th, textAlign: 'right' }}>SL</th>
                <th style={th}>Lý do</th>
                <th style={th}>Người đề nghị</th>
                <th style={th}>{view === 'PENDING' ? 'Thao tác' : 'Kết quả'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{lenhOf(r)}</td>
                  <td style={td}>{r.factoryCode}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.quantity}</td>
                  <td style={{ ...td, maxWidth: 320, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{r.reason}</td>
                  <td style={td}>
                    <div>{r.requestedByName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDateTimeVN(r.requestedAt)}</div>
                  </td>
                  <td style={td}>
                    {r.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { setActionError(null); setApproveTarget(r) }}
                          style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--bg-c62828)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                        >Duyệt huỷ</button>
                        <button
                          onClick={() => { setActionError(null); setReason(''); setRejectTarget(r) }}
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}
                        >Từ chối</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600, color: r.status === 'APPROVED' ? 'var(--fg-c62828)' : 'var(--text2)' }}>{STATUS_TEXT[r.status]}</div>
                        {r.decisionNote && <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{r.status === 'REJECTED' ? 'Lý do: ' : ''}{r.decisionNote}</div>}
                        {r.decidedByName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.decidedByName} · {fmtDateTimeVN(r.decidedAt)}</div>}
                        {r.status === 'APPROVED' && (
                          <button onClick={() => setViewTarget(r)} style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer' }}>Xem sắt / mua / hàng</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={approveTarget != null} onClose={busy ? undefined : closeModals} maxWidth={760}>
        {approveTarget && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Duyệt huỷ lệnh {lenhOf(approveTarget)}</h3>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text2)' }}>
              Huỷ SKU {approveTarget.factoryCode} ({approveTarget.quantity} cái)? Xưởng dừng làm SKU này, không hoàn tác được. SKU về
              &quot;chưa lên lệnh&quot; để Kế hoạch SX lên lệnh lại.
            </p>
            <CancelImpactPanel requestId={approveTarget.id} />
            {actionError && <div style={{ marginTop: 12, color: 'var(--fg-c62828)', fontSize: 12.5 }}>{actionError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={closeModals} disabled={busy} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button
                onClick={() => void decide(approveTarget, true)}
                disabled={busy}
                style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--bg-c62828)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >{busy ? 'Đang huỷ...' : 'Duyệt huỷ'}</button>
            </div>
          </>
        )}
      </Modal>
      <Modal open={viewTarget != null} onClose={() => setViewTarget(null)} maxWidth={760}>
        {viewTarget && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Lệnh {lenhOf(viewTarget)} · {viewTarget.factoryCode}</h3>
            <CancelImpactPanel requestId={viewTarget.id} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setViewTarget(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Đóng</button>
            </div>
          </>
        )}
      </Modal>
      <ReasonModal
        open={rejectTarget != null}
        title="Từ chối huỷ lệnh"
        description={rejectTarget ? `Lệnh ${lenhOf(rejectTarget)} (${rejectTarget.factoryCode}) chạy tiếp. Kế hoạch SX nhận lý do.` : undefined}
        reason={reason}
        onReasonChange={setReason}
        placeholder="Lý do từ chối"
        confirmLabel="Từ chối"
        busy={busy}
        confirmDisabled={reason.trim().length === 0}
        error={actionError}
        onConfirm={() => rejectTarget && void decide(rejectTarget, false)}
        onCancel={closeModals}
      />
    </div>
  )
}
