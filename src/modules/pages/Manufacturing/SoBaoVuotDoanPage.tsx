'use client'

/**
 * Sổ báo vượt tồn đoạn (13/11/2026, anh Nhân trả lời 11 câu tồn đoạn - câu 2, 6, 7, 9).
 *
 * Hàn / Sơn báo sản lượng KHÔNG bị chặn khi thiếu đoạn; hệ thống trừ phần giữ của lệnh (thiếu thì lấy dư của xưởng) và ghi 1 dòng ở
 * đây khi:
 *  - thiếu đoạn (không trừ được - tồn đoạn không âm), và / hoặc
 *  - đợt báo làm số mảnh vượt số lượng tổng của lệnh: "Làm lại" nếu trước đó KCS đã chấm lỗi mảnh / công đoạn này (Hàn lấy thêm sắt),
 *    không thì "Báo vượt".
 * QLSX xem và đóng từng dòng, bắt buộc ghi lý do (có nhật ký); người khác (Giám đốc, KHSX) chỉ xem. QLSX gắn xưởng chỉ thấy lệnh
 * thuộc xưởng mình (BE lọc).
 */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSegmentOverage, SegmentOverageStatus } from '../../../services/segment-stock-api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import ReasonModal from '../../../components/ReasonModal'
import RefreshButton from '../../../components/RefreshButton'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { compactTh as th, compactTd as td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'
import { useRealtimeRefetch } from '../../../realtime/hooks'

const STAGE_LABEL: Record<string, string> = { HAN: 'Hàn', SON: 'Sơn', PHOI: 'Phôi' }
const STATUS_OPTIONS: { value: SegmentOverageStatus; label: string }[] = [
  { value: 'open', label: 'Chưa xử lý' },
  { value: 'resolved', label: 'Đã đóng' },
  { value: 'all', label: 'Tất cả' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function vuotText(r: BeSegmentOverage): string | null {
  if (r.extraQty <= 0) return null
  const kind = r.extraKind === 'REWORK' ? 'Làm lại' : 'Báo vượt'
  return `${kind}: ${fmt(r.overPieces)} mảnh vượt lệnh, lấy thêm ${fmt(r.extraQty)} đoạn`
}

export default function SoBaoVuotDoanPage({ canResolve }: { canResolve: boolean }) {
  const [status, setStatus] = useState<SegmentOverageStatus>('open')
  const { data, isLoading, error, refetch } = useFetch<BeSegmentOverage[]>(() => api.getSegmentOverages({ status }), [status])
  // Báo sản lượng / KCS ghi tồn kho -> có thể sinh dòng mới.
  useRealtimeRefetch(['stock'], refetch)

  const [target, setTarget] = useState<BeSegmentOverage | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const close = () => { if (busy) return; setTarget(null); setReason(''); setActionError(null) }
  const submit = async () => {
    if (!target) return
    setBusy(true)
    setActionError(null)
    try {
      await api.resolveSegmentOverage(target.id, reason.trim())
      setTarget(null)
      setReason('')
      refetch()
    } catch (e) {
      setActionError(errMsg(e, 'Không đóng được dòng này'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} /> Sổ báo vượt đoạn
          </h2>
          <div style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
            Hàn / Sơn báo khi thiếu đoạn hoặc làm vượt số lượng lệnh vẫn được ghi nhận; dòng ở đây để {canResolve ? 'QLSX kiểm tra rồi đóng (ghi lý do)' : 'theo dõi'}.
          </div>
        </div>
        <RefreshButton onRefresh={refetch} loading={isLoading} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(o => (
          <button key={o.value} onClick={() => setStatus(o.value)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', border: '1px solid',
              borderColor: o.value === status ? 'var(--fg-e65100)' : 'var(--border)',
              background: o.value === status ? 'var(--bg-fff3e0)' : 'var(--surface)',
              color: o.value === status ? 'var(--fg-e65100)' : 'var(--text2)',
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : error || !data ? <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} /> : (
        <div style={tableWrap}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Lúc báo</th>
                <th style={th}>Lệnh</th>
                <th style={th}>Mảnh</th>
                <th style={th}>Mã đoạn</th>
                <th style={{ ...th, textAlign: 'right' }}>Cần / lấy được</th>
                <th style={{ ...th, textAlign: 'right' }}>Thiếu</th>
                <th style={th}>Vượt lệnh</th>
                <th style={th}>Người báo</th>
                <th style={th}>{status === 'open' ? '' : 'Xử lý'}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtTime(r.createdAt)}</td>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.lenhCode}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.pieceCode}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.pieceName} · {STAGE_LABEL[r.stage] ?? r.stage}</div>
                  </td>
                  <td style={td}>
                    <div>{r.segmentLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.warehouseName}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(r.neededQty)} / {fmt(r.takenQty)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.shortageQty > 0 ? 'var(--fg-b91c1c)' : 'var(--text3)' }}>
                    {r.shortageQty > 0 ? fmt(r.shortageQty) : '—'}
                  </td>
                  <td style={{ ...td, color: r.extraQty > 0 ? 'var(--fg-d97706)' : 'var(--text3)' }}>{vuotText(r) ?? '—'}</td>
                  <td style={td}>{r.reportedByName ?? '—'}</td>
                  <td style={td}>
                    {r.resolvedAt ? (
                      <div style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: 'var(--fg-15803d)' }}>Đã đóng {fmtTime(r.resolvedAt)}</div>
                        <div style={{ color: 'var(--text3)' }}>{r.resolvedByName ?? '—'}: {r.resolveReason}</div>
                      </div>
                    ) : canResolve ? (
                      <button onClick={() => { setTarget(r); setReason(''); setActionError(null) }}
                        style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Đóng dòng
                      </button>
                    ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chưa xử lý</span>}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                  <div className="table-empty-msg">{status === 'open' ? 'Không có dòng báo vượt nào chờ xử lý' : 'Chưa có dòng nào'}</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ReasonModal
        open={!!target}
        title="Đóng dòng báo vượt"
        description={target ? `${target.lenhCode} · ${target.pieceCode} · ${target.segmentLabel}` : ''}
        reason={reason}
        onReasonChange={setReason}
        placeholder="Lý do đóng (bắt buộc) - vd đã đếm lại, Phôi cắt bù, cho qua khẩn..."
        onCancel={close}
        onConfirm={submit}
        confirmLabel="Đóng dòng"
        confirmColor="var(--bg-2e7d32)"
        busy={busy}
        confirmDisabled={reason.trim().length < 3}
        error={actionError}
      />
    </div>
  )
}
