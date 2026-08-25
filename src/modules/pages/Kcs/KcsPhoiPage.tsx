'use client'

/**
 * Màn hình KCS — Công đoạn PHÔI (2 tầng: PO → các đợt chờ kiểm).
 *
 * Viết lại hoàn toàn (2026-08-24) — KHÔNG còn dùng chung `kcsCore.tsx`/`KcsTwoTierScreen` với
 * Hàn/Sơn nữa: Sếp chốt Phôi chấm THEO TỪNG CỠ ĐOẠN (khác Hàn/Sơn vẫn chấm cả lô theo số lượng
 * đơn thuần - production_batch chưa có "cỡ" gì để bóc). Tách riêng để không đụng kcsCore.tsx
 * (Hàn/Sơn dùng, không được vỡ).
 *
 * KCS chỉ chấm 2 kết quả: Đạt/Không đạt (2026-08-24, vòng 2 - bỏ hẳn "lỗi sửa được" đã thử ở vòng
 * 1). Đợt đóng QC_PASSED ngay. Phôi tự bù đoạn không đạt bằng sắt kiếm ngoài thực tế (KHÔNG qua
 * hệ thống), bấm "Bù đủ" bên LenhSanXuatPhoi.tsx - màn NÀY thêm bước KCS phải DUYỆT LẠI (RecheckModal
 * bên dưới) mới tính là hết lỗi, xem QcReviewsService.reportSegmentDone/recheck (BE).
 */

import { useMemo, useState } from 'react'
import { ClipboardCheck, Check, Clock, ChevronLeft, ChevronRight, AlertTriangle, Upload, X, Plus, Wrench, RotateCcw } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview, BeCutBundle } from '../../../services/steel-issues-api'
import type { BeDefectReason } from '../../../services/defect-reasons-api'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#e65100'
const GREEN = '#16a34a'
const RED = '#c62828'
const AMBER = '#d97706'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

interface PiAgg { productionInvoiceId: string; poNumber: string; issues: BeSteelIssue[]; pendingCount: number }

/** 1 đợt sắt đang "chờ duyệt lại" nếu có ít nhất 1 cỡ đoạn Phôi đã bấm "Bù đủ" (phoiReportedAt !=
 *  null) mà vẫn còn outstanding (failedQty - resolvedQty > 0) - KCS chưa xử lý xong. */
function hasAwaitingRecheck(review: BeQcReview | undefined): boolean {
  return (review?.segments ?? []).some((s) => s.phoiReportedAt != null && s.failedQty - s.resolvedQty > 0)
}

function buildPiRows(issues: BeSteelIssue[], reviews: BeQcReview[]): PiAgg[] {
  // Chỉ PI có đợt liên quan KCS (đã báo cắt xong trở lên) - Phôi chưa cắt xong thì chưa liên quan.
  const relevant = issues.filter((i) => i.status === 'AWAITING_QC' || i.status === 'QC_PASSED')
  const reviewByIssue = new Map<string, BeQcReview>()
  for (const r of reviews) if (r.steelIssueId) reviewByIssue.set(r.steelIssueId, r)
  const byPi = new Map<string, BeSteelIssue[]>()
  const order: string[] = []
  for (const i of relevant) {
    if (!byPi.has(i.productionInvoiceId)) { byPi.set(i.productionInvoiceId, []); order.push(i.productionInvoiceId) }
    byPi.get(i.productionInvoiceId)!.push(i)
  }
  return order
    .map((productionInvoiceId) => {
      const list = byPi.get(productionInvoiceId)!
      // "Đợt chờ kiểm" = chờ duyệt LẦN ĐẦU (AWAITING_QC) + chờ DUYỆT LẠI (QC_PASSED, Phôi đã báo
      // bù đủ) - cả 2 đều là việc KCS phải làm, gộp chung 1 số cho thợ khỏi bỏ sót đợt nào.
      const pendingCount = list.filter(
        (i) => i.status === 'AWAITING_QC' || hasAwaitingRecheck(reviewByIssue.get(i.id)),
      ).length
      return {
        productionInvoiceId,
        poNumber: list[0].salesOrderCode ?? list[0].piCode,
        issues: list,
        pendingCount,
      }
    })
    .sort((a, b) => b.pendingCount - a.pendingCount)
}

export default function KcsPhoiPage() {
  const { data: issues, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews, refetch: refetchReviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [selPi, setSelPi] = useState<string | null>(null)

  const piRows = useMemo(() => buildPiRows(issues ?? [], reviews ?? []), [issues, reviews])
  const refetchAll = () => { refetch(); refetchReviews() }

  if (isLoading || !issues) return <LoadingState />

  const sel = selPi ? piRows.find((r) => r.productionInvoiceId === selPi) ?? null : null
  if (sel) {
    return <PiDetail pi={sel} reviews={reviews ?? []} onBack={() => setSelPi(null)} onRefetch={refetchAll} />
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={20} /> Màn hình KCS — Công đoạn Phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Kiểm tra chất lượng theo từng cỡ đoạn — bấm vào PO có đợt chờ kiểm để duyệt.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={thR}>Đợt chờ kiểm</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map((r) => (
              <tr key={r.productionInvoiceId} onClick={() => setSelPi(r.productionInvoiceId)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.poNumber}</td>
                <td style={tdR}>
                  {r.pendingCount > 0
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AMBER, fontWeight: 700 }}><Clock size={12} /> {r.pendingCount}</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GREEN }}><Check size={12} /> đã duyệt hết</span>}
                </td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {piRows.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có đợt nào chờ kiểm</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PiDetail({ pi, reviews, onBack, onRefetch }: {
  pi: PiAgg; reviews: BeQcReview[]; onBack: () => void; onRefetch: () => void
}) {
  const [target, setTarget] = useState<BeSteelIssue | null>(null)
  const [recheckTarget, setRecheckTarget] = useState<BeSteelIssue | null>(null)

  const reviewByIssue = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.steelIssueId) m.set(r.steelIssueId, r)
    return m
  }, [reviews])

  const rank = (l: BeSteelIssue) =>
    l.status === 'AWAITING_QC' ? 0 : hasAwaitingRecheck(reviewByIssue.get(l.id)) ? 1 : 2
  const rows = [...pi.issues].sort((a, b) => {
    const r = rank(a) - rank(b)
    return r !== 0 ? r : (b.completedAt ?? b.issuedAt).localeCompare(a.completedAt ?? a.issuedAt)
  })

  const recheckReview = recheckTarget ? reviewByIssue.get(recheckTarget.id) : undefined

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Loại sắt</th>
              <th style={thR}>Số cây</th>
              <th style={th}>Báo cắt xong lúc</th>
              <th style={{ ...th, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...th, width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const review = reviewByIssue.get(l.id)
              const baoCat = l.actualBarCount ?? l.barCount
              // failedQty là số ĐOẠN (KCS chấm theo cỡ đoạn), KHÁC đơn vị baoCat (cây) - không
              // được lấy hiệu 2 số này. outstanding = Σ(failedQty - resolvedQty) GIẢM DẦN khi KCS
              // duyệt lại xác nhận đạt (2026-08-24, vòng 2).
              const segs = review?.segments ?? []
              const outstanding = segs.reduce((s, x) => s + (x.failedQty - x.resolvedQty), 0)
              const awaitingRecheck = hasAwaitingRecheck(review)
              return (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{l.materialName}</td>
                  <td style={tdR}>{baoCat}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{l.completedAt ? new Date(l.completedAt).toLocaleString('vi-VN') : '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {l.status === 'AWAITING_QC' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ kiểm</span>
                    ) : outstanding > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: RED }}>Lỗi {outstanding} đoạn</span>
                        {awaitingRecheck && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: AMBER }}>
                            <RotateCcw size={11} /> chờ duyệt lại
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đạt</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {l.status === 'AWAITING_QC' && (
                      <button onClick={() => setTarget(l)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
                        <ClipboardCheck size={13} /> Tiến hành duyệt
                      </button>
                    )}
                    {awaitingRecheck && (
                      <button onClick={() => setRecheckTarget(l)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: AMBER, color: '#fff', cursor: 'pointer' }}>
                        <RotateCcw size={13} /> Duyệt lại
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {target && (
        <QcReviewModal issue={target} onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); onRefetch() }} />
      )}

      {recheckTarget && recheckReview && (
        <RecheckModal issue={recheckTarget} review={recheckReview} onClose={() => setRecheckTarget(null)}
          onDone={() => { setRecheckTarget(null); onRefetch() }} />
      )}
    </div>
  )
}

// ── Modal duyệt: nhập lỗi THEO TỪNG CỠ ĐOẠN của chính đợt này ────────────

interface SegRow { segmentSpecId: string; cutLengthMm: number; cutQty: number }

function aggregateBundles(bundles: BeCutBundle[]): SegRow[] {
  const map = new Map<string, SegRow>()
  for (const b of bundles) {
    for (const s of b.segments) {
      const row = map.get(s.segmentSpecId)
      if (row) row.cutQty += s.qty
      else map.set(s.segmentSpecId, { segmentSpecId: s.segmentSpecId, cutLengthMm: s.cutLengthMm, cutQty: s.qty })
    }
  }
  return [...map.values()].sort((a, b) => b.cutLengthMm - a.cutLengthMm)
}

function QcReviewModal({ issue, onClose, onDone }: {
  issue: BeSteelIssue; onClose: () => void; onDone: () => void
}) {
  const { data: bundles, isLoading: bundlesLoading } = useFetch<BeCutBundle[]>(() => api.getCutBundles(issue.id), [issue.id])
  const { data: reasons, refetch: refetchReasons } = useFetch<BeDefectReason[]>(() => api.getDefectReasons('PHOI'), [])

  const [failedByseg, setFailedByseg] = useState<Record<string, string>>({})
  const [reasonId, setReasonId] = useState<string>('')
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const segments = useMemo(() => aggregateBundles(bundles ?? []), [bundles])
  const list = reasons ?? []

  const rows = segments.map((s) => {
    const raw = Math.floor(Number(failedByseg[s.segmentSpecId]) || 0)
    const failed = Math.max(0, Math.min(s.cutQty, raw))
    return { ...s, failed }
  })
  const totalFailed = rows.reduce((sum, r) => sum + r.failed, 0)
  const totalCut = rows.reduce((sum, r) => sum + r.cutQty, 0)
  const totalPassed = totalCut - totalFailed

  const addReason = async () => {
    if (!newLabel.trim()) return
    setAdding(true); setErr('')
    try {
      const created = await api.createDefectReason({ label: newLabel.trim(), stageType: 'PHOI' })
      setNewLabel('')
      await refetchReasons()
      setReasonId(String(created.id))
    } catch { setErr('Không thêm được loại lỗi') }
    finally { setAdding(false) }
  }

  const onPickPhoto = async (file?: File) => {
    if (!file) return
    setUploading(true); setErr('')
    try { setPhotoUrl(await api.uploadImage(file)) }
    catch { setErr('Tải ảnh thất bại') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (totalFailed > 0 && !reasonId) { setErr('Có đoạn không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      await api.reviewSteelIssueQc(issue.id, {
        segments: rows.filter((r) => r.failed > 0).map((r) => ({ segmentSpecId: r.segmentSpecId, failedQty: r.failed })),
        defectReasonId: totalFailed > 0 ? reasonId : undefined,
        reason: note || undefined,
        photoUrl: photoUrl || undefined,
      })
      onDone()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tiến hành duyệt — {issue.materialName}</h3>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>

        {bundlesLoading ? <LoadingState /> : (
          <div style={{ ...card, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Cỡ đoạn</th>
                  <th style={thR}>Đã cắt (đợt này)</th>
                  <th style={{ ...thR, width: 100 }}>Không đạt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                    <td style={tdR}>{s.cutQty}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" min={0} max={s.cutQty} placeholder="0"
                        value={failedByseg[s.segmentSpecId] ?? ''}
                        onChange={(e) => setFailedByseg((p) => ({ ...p, [s.segmentSpecId]: e.target.value }))}
                        style={{ width: 64, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Chưa có đợt cắt nào ghi nhận cho lô này</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Đạt: <b style={{ color: GREEN }}>{totalPassed}</b> · Không đạt: <b style={{ color: totalFailed > 0 ? RED : 'var(--text3)' }}>{totalFailed}</b>
        </div>

        {totalFailed > 0 && <>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Nguyên nhân không đạt *</label>
          <select value={reasonId} onChange={(e) => setReasonId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}>
            <option value="">— chọn nguyên nhân —</option>
            {list.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addReason() }}
              placeholder="+ Thêm loại lỗi mới…"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={addReason} disabled={adding || !newLabel.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Thêm
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Ghi chú</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }} />

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Hình ảnh</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              <Upload size={14} /> {uploading ? 'Đang tải…' : 'Chọn ảnh'}
              <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0])} />
            </label>
            {photoUrl && <img src={photoUrl} alt="lỗi" style={{ height: 40, borderRadius: 4, border: '1px solid var(--border)' }} />}
          </div>
        </>}

        {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          <button onClick={submit} disabled={busy || uploading || bundlesLoading}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? '...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal duyệt lại: KCS kiểm các cỡ đoạn Phôi đã báo "Bù đủ" (2026-08-24, vòng 2) ────────
// Chỉ liệt kê cỡ đang phoiReportedAt != null (đã báo, chưa xử lý) - nhập số ĐANG CÒN HỎNG (mặc
// định 0 = đạt hết), KHÔNG bắt gõ lại toàn bộ failedQty gốc.

function RecheckModal({ issue, review, onClose, onDone }: {
  issue: BeSteelIssue; review: BeQcReview; onClose: () => void; onDone: () => void
}) {
  const rows = review.segments.filter((s) => s.phoiReportedAt != null && s.failedQty - s.resolvedQty > 0)
  const [remainingBySeg, setRemainingBySeg] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const segments = rows.map((s) => {
      const outstanding = s.failedQty - s.resolvedQty
      const raw = Math.floor(Number(remainingBySeg[s.segmentSpecId]) || 0)
      return { segmentSpecId: s.segmentSpecId, remainingFailedQty: Math.max(0, Math.min(outstanding, raw)) }
    })
    setBusy(true); setErr('')
    try {
      await api.recheckQc(issue.id, segments)
      onDone()
    } catch (e) { setErr(errMsg(e, 'Không duyệt lại được')) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={16} /> Duyệt lại — {issue.materialName}
          </h3>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Phôi đã tự bù các cỡ đoạn dưới đây bằng sắt kiếm ngoài thực tế — nhập số đoạn ĐANG CÒN HỎNG (0 = đạt hết).
        </div>

        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Cỡ đoạn</th>
                <th style={thR}>Đã chấm lỗi</th>
                <th style={{ ...thR, width: 110 }}>Còn hỏng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const outstanding = s.failedQty - s.resolvedQty
                return (
                  <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                    <td style={tdR}>{outstanding}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" min={0} max={outstanding} placeholder="0"
                        value={remainingBySeg[s.segmentSpecId] ?? ''}
                        onChange={(e) => setRemainingBySeg((p) => ({ ...p, [s.segmentSpecId]: e.target.value }))}
                        style={{ width: 64, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Không còn cỡ đoạn nào chờ duyệt lại</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          <button onClick={submit} disabled={busy || rows.length === 0}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: AMBER, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? '...' : 'Xác nhận duyệt lại'}
          </button>
        </div>
      </div>
    </div>
  )
}
