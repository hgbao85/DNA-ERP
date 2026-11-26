'use client'

/**
 * Kho Thành phẩm khi bật Chuyền kiểm / Đóng gói bằng quét QR (24/11/2026, docs THIET-KE-CHUYEN-KIEM-DONG-GOI-QR):
 *  - CkMonitorPanel: tab "Chuyền kiểm" thành màn THEO DÕI (chỉ xem) - đợt công nhân báo, kết quả KCS chuyền kiểm, ảnh lỗi.
 *  - DgReconcilePanel: tab "Đóng gói" thành màn ĐỐI CHIẾU - lần công nhân đóng gói báo (tính luôn), huỷ lần báo sai có lý do (D4).
 * Mảnh chưa kiểm / số đã đóng theo từng lệnh vẫn xem ở bảng cũ (chế độ chỉ xem) đặt bên dưới - xem KhoChuyenKiemPage / KhoDongGoiPage.
 */

import { useState, type CSSProperties } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  cancelPackingReport, getCkBatches, getPackingReports, type CkBatch, type CkBatchStatus, type DgReport,
} from '../../../services/ck-dg-api'
import Modal from '../../../components/Modal'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageSubtitle, pageTitle } from '../../../styles/typography'
import { errMsg } from '../../../utils/errors'
import {
  batchKcsText, batchReportText, cancelReasonOk, matchesQuery, monitorTotals, reconcileTotals,
} from '../Floor/ckdg/ckDgModel'

const th: CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '8px 12px', color: 'var(--text)', fontSize: 13, verticalAlign: 'top' }
const box: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }
const searchInput: CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)',
  color: 'var(--text)', minWidth: 220,
}
const tabBtn = (on: boolean): CSSProperties => ({
  padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, background: on ? 'var(--blue-bg)' : 'var(--surface)',
  color: on ? 'var(--blue-text)' : 'var(--text2)',
})
const when = (iso: string) => format(new Date(iso), 'dd/MM HH:mm')

/** Thủ kho gắn kho chỉ thấy đợt / lần báo ở điểm thuộc kho mình. */
const inScope = (scope: string | null | undefined, code: string | null) => !scope || !code || code === scope

function Thumbs({ urls }: { urls: string[] }) {
  if (urls.length === 0) return <span style={{ color: 'var(--text3)' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary công nhân chụp */}
          <img src={u} alt="Ảnh lỗi" style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', display: 'block' }} />
        </a>
      ))}
    </div>
  )
}

export function CkMonitorPanel({ warehouseScope }: { warehouseScope?: string | null }) {
  const [status, setStatus] = useState<CkBatchStatus | 'ALL'>('AWAITING_KCS')
  const [q, setQ] = useState('')
  const { data, isLoading, error, refetch } = useFetch(
    () => getCkBatches(status === 'ALL' ? {} : { status }),
    [status],
  )
  useRealtimeRefetch(['skus'], () => { void refetch() })
  const rows = (data?.batches ?? []).filter((b) => inScope(warehouseScope, b.warehouseCode) && matchesQuery(b, q))
  const t = monitorTotals(rows)
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ ...pageTitle, margin: 0 }}>Chuyền kiểm</h2>
      <p style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Công nhân chuyền kiểm tự báo bằng quét tem, KCS chuyền kiểm chấm - màn này chỉ để theo dõi. Số chỉ tính “đã qua chuyền kiểm” khi KCS chấm đạt.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {([['AWAITING_KCS', 'Chờ KCS'], ['KCS_DONE', 'Đã chấm'], ['ALL', 'Tất cả']] as const).map(([k, label]) => (
          <button key={k} type="button" style={tabBtn(status === k)} onClick={() => setStatus(k)}>{label}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lệnh, SKU, mảnh, người báo…" style={searchInput} aria-label="Tìm đợt chuyền kiểm" />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          {t.awaiting > 0 && <>Chờ KCS: <b>{t.awaiting}</b> đợt ({t.awaitingQty} mảnh) · </>}
          KCS đạt <b>{t.passed}</b> · làm lại <b>{t.rework}</b> · bỏ <b>{t.scrap}</b>
        </span>
      </div>
      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={refetch} /> : (
        <div style={box}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Giờ báo</th><th style={th}>Người báo</th><th style={th}>Lệnh · SKU</th><th style={th}>Mảnh</th>
              <th style={th}>Công nhân báo</th><th style={th}>Ảnh lỗi</th><th style={th}>KCS chuyền kiểm</th>
            </tr></thead>
            <tbody>
              {rows.map((b: CkBatch) => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(b.reportedAt)}</td>
                  <td style={td}>{b.reportedByName ?? '—'}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.workstationCode}</div></td>
                  <td style={td}><b>{b.lenhCode}</b> · {b.sku}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.productName}</div></td>
                  <td style={td}>{b.pieceName}</td>
                  <td style={td}>{batchReportText(b)}{b.note && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.note}</div>}</td>
                  <td style={td}><Thumbs urls={[...b.photoUrls, ...(b.kcs?.photoUrl ? [b.kcs.photoUrl] : [])]} /></td>
                  <td style={{ ...td, color: b.kcs ? 'var(--text)' : 'var(--amber)' }}>
                    {batchKcsText(b)}
                    {b.kcs && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{[b.kcs.defectReason, b.kcs.reviewedByName, b.kcs.reviewedAt ? when(b.kcs.reviewedAt) : null].filter(Boolean).join(' · ')}</div>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Không có đợt nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CancelModal({ report, onClose, onDone }: { report: DgReport | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<DgReport | null>(null)
  if (report !== openedFor) { setOpenedFor(report); setReason(''); setErr(null) }
  if (!report) return null
  const ok = cancelReasonOk(reason) && !busy
  const save = async () => {
    setBusy(true); setErr(null)
    try { await cancelPackingReport(report.id, reason.trim()); onDone() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={440}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) void save() }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Huỷ lần báo đóng gói</div>
        <div style={{ fontSize: 13 }}>
          {report.reportedByName ?? '—'} báo <b>{report.qty} bộ</b> · {report.lenhCode} · {report.sku} lúc {when(report.reportedAt)}.
          Huỷ thì trừ lại {report.qty} bộ khỏi số đã đóng; QLSX và công nhân nhận thông báo.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Lý do huỷ *
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            placeholder="vd Đếm nhầm thùng, báo trùng" />
        </label>
        {err && <div style={{ color: 'var(--fg-c62828)', fontSize: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>Đóng</button>
          <button type="submit" disabled={!ok} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: ok ? 'var(--fg-c62828)' : 'var(--surface2)', color: ok ? '#fff' : 'var(--text3)', cursor: ok ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Đang huỷ…' : 'Huỷ lần báo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function DgReconcilePanel({ warehouseScope, readOnly = false }: { warehouseScope?: string | null; readOnly?: boolean }) {
  const [q, setQ] = useState('')
  const [cancelling, setCancelling] = useState<DgReport | null>(null)
  const { data, isLoading, error, refetch } = useFetch(() => getPackingReports(), [])
  useRealtimeRefetch(['skus'], () => { void refetch() })
  const rows = (data?.reports ?? []).filter((r) => inScope(warehouseScope, r.warehouseCode) && matchesQuery(r, q))
  const t = reconcileTotals(rows)
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <CancelModal report={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); void refetch() }} />
      <h2 style={{ ...pageTitle, margin: 0 }}>Đóng gói</h2>
      <p style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Công nhân đóng gói tự báo bằng quét tem, số tính luôn (chỉ đóng được số bộ đã qua KCS chuyền kiểm). Đối chiếu với thực tế, báo sai thì huỷ có lý do.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lệnh, SKU, người báo…" style={searchInput} aria-label="Tìm lần báo đóng gói" />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          Đang tính <b>{t.activeQty}</b> bộ ({t.active} lần báo){t.cancelled > 0 && <> · đã huỷ {t.cancelled} lần ({t.cancelledQty} bộ)</>}
        </span>
      </div>
      {isLoading ? <LoadingState /> : error ? <LoadErrorState error={error} onRetry={refetch} /> : (
        <div style={box}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Giờ báo</th><th style={th}>Người báo</th><th style={th}>Lệnh · SKU</th>
              <th style={{ ...th, textAlign: 'right' }}>Số bộ</th><th style={th}>Trạng thái</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', opacity: r.cancelled ? 0.6 : 1 }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(r.reportedAt)}</td>
                  <td style={td}>{r.reportedByName ?? '—'}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.workstationCode}{r.locationCode ? ` · cất ô ${r.locationCode}` : ''}</div></td>
                  <td style={td}><b>{r.lenhCode}</b> · {r.sku}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.productName}</div></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, textDecoration: r.cancelled ? 'line-through' : undefined }}>{r.qty}</td>
                  <td style={td}>
                    {r.cancelled
                      ? <span style={{ color: 'var(--fg-c62828)' }}>Đã huỷ · {r.cancelReason}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.cancelledByName}{r.cancelledAt ? ` · ${when(r.cancelledAt)}` : ''}</div></span>
                      : <span style={{ color: 'var(--fg-16a34a)' }}>Đang tính</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {!r.cancelled && !readOnly && (
                      <button type="button" onClick={() => setCancelling(r)} style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid rgba(198,40,40,.35)', borderRadius: 6, background: 'none', color: 'var(--fg-c62828)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Huỷ lần báo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Chưa có lần báo đóng gói nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
