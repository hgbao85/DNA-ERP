'use client'

/**
 * Lệnh sản xuất — Công đoạn Phôi (theo dõi tiến độ + báo cắt xong theo PO/PI → từng đợt sắt).
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi"): dựng thẳng từ GET /steel-issues (flat, cùng
 * nguồn dữ liệu "Xác nhận nhận sắt") — PHOI_STAFF chỉ có STEEL_ISSUE:VIEW, không có
 * SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự resolve steel-issue-plan (BOM) theo PI như phía kho
 * (XuatSatPage) được.
 *
 * B4 Đợt 3d (2026-08-19): gom theo PI + LOẠI SẮT (không còn theo mảnh) — SteelIssue giờ gộp theo
 * cả PI, không còn gắn 1 mảnh cụ thể (xem changelog 2026-08-18-xuat-sat-po-pi-vat-tu.md).
 *
 * Phạm vi (2026-08-22, chốt lại lần 2): xác nhận NHẬN sắt làm ở màn riêng "Xác nhận nhận sắt".
 * Màn NÀY làm phần còn lại của vòng đời sau khi nhận: báo cắt xong, đánh dấu công đoạn chi tiết
 * (uốn/dập/...). Vì báo cắt xong thao tác trên TỪNG ĐỢT xuất cụ thể (SteelIssue.id), chi tiết 1 PI
 * hiện theo dòng-đợt phẳng thay vì gộp theo loại sắt như bản đọc-only cũ.
 *
 * Báo cắt xong (2026-08-22, chốt lại lần 2 - lần đầu bị rollback 08-21 vì thảo luận sai phạm vi
 * màn, không phải sai thiết kế): Phôi KHAI THẲNG số đoạn thực cắt theo TỪNG CỠ (recordCutBatch),
 * hệ thống tự tính phế liệu qua phương trình cân bằng vật chất - không còn "chọn kiểu cắt đã duyệt
 * rồi FE tự bung đoạn" (completeCutting cũ, số liệu thực chất là CHÉP từ kế hoạch solver, không
 * phải ĐO). Kiểu cắt của solver chỉ còn là bảng tham khảo, thu gọn. "Báo cắt xong" tách làm 2 hành
 * động độc lập: nhập từng đợt (nhiều lần, cộng dồn) + "Gửi KCS" (tín hiệu thuần, không mang
 * số liệu, KHÔNG tự động khi Còn lại = 0 vì ca cắt thiếu do sắt hỏng/cong vẫn phải đi tiếp được).
 *
 * KCS chấm lỗi (2026-08-24, vòng 2): CHỈ 2 kết quả Đạt/Không đạt. Đợt QC_PASSED còn lỗi (outstanding
 * > 0) vẫn mở ra xem được bảng Cần/Đã cắt/Lỗi/Còn lại, nhưng KHÔNG còn ô nhập đợt cắt - Phôi tự bù
 * bằng sắt kiếm ngoài thực tế (KHÔNG đụng cây sắt kho đã cấp), bấm "Bù đủ" rồi CHỜ KCS duyệt lại
 * (QcReviewsService.reportSegmentDone/recheck) mới hết lỗi.
 */

import { useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Wrench, Clock, Check, AlertTriangle, RotateCcw, Plus, Ruler,
} from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type {
  BeSteelIssue, BeQcReview, BePhoiProgressItem, BeCutBundle,
} from '../../../services/steel-issues-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#e65100'
const GREEN = '#16a34a'
const RED = '#c62828'
const AMBER = '#d97706'
const PURPLE = '#7b1fa2'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const smallBtn: React.CSSProperties = { padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }
const inp: React.CSSProperties = { width: 72, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }

interface PiAgg { productionInvoiceId: string; poNumber: string; issues: BeSteelIssue[]; totalIssued: number; totalPassed: number; totalAwaiting: number }

function buildPiRows(issues: BeSteelIssue[]): PiAgg[] {
  // Gom theo productionInvoiceId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode -
  // nhiều lệnh SX có thể cùng chung 1 mã Sales (nhiều SKU/đơn) hoặc cùng null.
  const byPi = new Map<string, BeSteelIssue[]>()
  const order: string[] = []
  for (const i of issues) {
    if (!byPi.has(i.productionInvoiceId)) { byPi.set(i.productionInvoiceId, []); order.push(i.productionInvoiceId) }
    byPi.get(i.productionInvoiceId)!.push(i)
  }
  return order.map(productionInvoiceId => {
    const list = byPi.get(productionInvoiceId)!
    const awaiting = list.reduce((s, i) => {
      if (i.status === 'ISSUED' || i.status === 'RECEIVED') return s + i.barCount
      if (i.status === 'IN_PROCESS' || i.status === 'AWAITING_QC') return s + (i.actualBarCount ?? i.barCount)
      return s
    }, 0)
    // "Đã KCS đạt" tính theo CÂY (đợt đã duyệt xong, status QC_PASSED) - KHÔNG trừ failedByIssue
    // nữa: failedQty giờ là số ĐOẠN (từ 2026-08-24, chấm theo cỡ đoạn), khác đơn vị với cây, và
    // 1 vài đoạn lỗi (sửa được) không có nghĩa cả CÂY bị loại - cây vẫn đã qua KCS bình thường.
    const passed = list.filter(i => i.status === 'QC_PASSED')
      .reduce((s, i) => s + (i.actualBarCount ?? i.barCount), 0)
    return {
      productionInvoiceId, poNumber: list[0].salesOrderCode ?? list[0].piCode, issues: list,
      totalIssued: list.reduce((s, i) => s + i.barCount, 0),
      totalPassed: passed, totalAwaiting: awaiting,
    }
  })
}

export default function LenhSanXuatPhoi({ readOnly = false, onOpenCuttingGuide }: {
  readOnly?: boolean
  /** Nhảy sang màn "Hướng dẫn cắt" (sidebar riêng) đúng PI đang mở - xem CutBatchPanel. */
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  const { data: issues, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews, refetch: refetchReviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [selPi, setSelPi] = useState<string | null>(null)

  const piRows = useMemo(() => buildPiRows(issues ?? []), [issues])
  const refetchAll = () => { refetch(); refetchReviews() }

  if (isLoading || !issues) return <LoadingState />

  const sel = selPi ? piRows.find(r => r.productionInvoiceId === selPi) ?? null : null

  if (sel) {
    return (
      <PiDetail pi={sel} readOnly={readOnly} reviews={reviews ?? []} onBack={() => setSelPi(null)} onRefetch={refetchAll} onOpenCuttingGuide={onOpenCuttingGuide} />
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={20} /> Lệnh sản xuất — Công đoạn Phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Theo dõi tiến độ cắt sắt theo PO/PI — bấm để báo cắt xong / đánh dấu công đoạn theo từng đợt. Xác nhận nhận sắt làm ở <b>Xác nhận nhận sắt</b>.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={thR}>Đã xuất (cây)</th>
              <th style={thR}>Đang xử lý</th>
              <th style={thR}>Đã KCS đạt</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map(r => (
              <tr key={r.productionInvoiceId} onClick={() => setSelPi(r.productionInvoiceId)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.poNumber}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{r.totalIssued}</td>
                <td style={tdR}>
                  {r.totalAwaiting > 0
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 600 }}><Clock size={12} /> {r.totalAwaiting}</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a' }}><Check size={12} /> xong</span>}
                </td>
                <td style={{ ...tdR, color: '#16a34a', fontWeight: 700 }}>{r.totalPassed}</td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {piRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PI nào được xuất sắt</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Chi tiết 1 PI — danh sách phẳng từng đợt, báo cắt xong / đánh dấu công đoạn ────────────

function PiDetail({ pi, readOnly, reviews, onBack, onRefetch, onOpenCuttingGuide }: {
  pi: PiAgg; readOnly: boolean; reviews: BeQcReview[]; onBack: () => void; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  const { data: progress, refetch: refetchProgress } = useFetch<BePhoiProgressItem[]>(
    () => api.getPhoiProgress(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  const progressByMaterial = useMemo(() => {
    const m = new Map<string, BePhoiProgressItem>()
    for (const p of progress ?? []) m.set(p.materialId, p)
    return m
  }, [progress])
  // Nhập đợt cắt/mời KCS đổi cả phoi-progress (Cần/Đã cắt) lẫn steel-issues/qc-reviews (trạng
  // thái) - phải refetch cả 2 nguồn, không chỉ mỗi onRefetch() của cha.
  const refetchAll = () => { onRefetch(); refetchProgress() }

  const reviewByIssue = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.steelIssueId) m.set(r.steelIssueId, r)
    return m
  }, [reviews])

  const toggle = (issueId: string) => setOpen(o => ({ ...o, [issueId]: !o[issueId] }))

  const doCompleteStep = async (l: BeSteelIssue, step: ProcessStep) => {
    setBusy(l.id); setErr(p => ({ ...p, [l.id]: '' }))
    try { await api.completeStep(l.id, step); onRefetch() }
    catch (e) { setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không đánh dấu công đoạn được') })) }
    finally { setBusy(null) }
  }

  // Thứ tự ưu tiên: đợt trả về (rework) → đã nhận (chờ báo) → đang gia công (chờ đánh dấu công
  // đoạn) → chờ nhận (chưa tới lượt màn này) → chờ KCS → đã duyệt (mờ).
  const rank = (l: BeSteelIssue) =>
    l.reworkOfId ? 0
      : l.status === 'RECEIVED' ? 1
      : l.status === 'IN_PROCESS' ? 2
      : l.status === 'ISSUED' ? 3
      : l.status === 'AWAITING_QC' ? 4
      : 5
  const rows = [...pi.issues].sort((a, b) => {
    const r = rank(a) - rank(b)
    return r !== 0 ? r : b.issuedAt.localeCompare(a.issuedAt)
  })
  const traVeList = pi.issues.filter(l => l.status === 'RECEIVED' && l.reworkOfId)
  const traVe = traVeList.length
  const traVeCay = traVeList.reduce((s, l) => s + l.barCount, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>cắt lại</b> · tổng <b>{traVeCay}</b> cây.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(l => {
          const isOpen = !!open[l.id]
          const review = reviewByIssue.get(l.id)
          const baoCat = l.actualBarCount ?? l.barCount
          // failedQty là số ĐOẠN (KCS chấm theo cỡ đoạn), KHÁC đơn vị baoCat (cây) - không lấy
          // hiệu 2 số này ("Đạt" theo cây trừ "Lỗi" theo đoạn là vô nghĩa).
          // outstanding = Σ(failedQty - resolvedQty) - GIẢM DẦN khi KCS duyệt lại xác nhận đạt
          // (2026-08-24, vòng 2 - khác failedQty tổng cố định của bản trước).
          const segs = review?.segments ?? []
          const outstanding = segs.reduce((s, x) => s + (x.failedQty - x.resolvedQty), 0)
          const awaitingRecheck = segs.some((x) => x.phoiReportedAt != null && x.failedQty - x.resolvedQty > 0)
          const isReturn = l.status === 'RECEIVED' && !!l.reworkOfId
          const canExpand = l.status === 'RECEIVED' || (l.status === 'QC_PASSED' && outstanding > 0)
          return (
            <div key={l.id} style={{ ...card, borderColor: isReturn ? RED : undefined }}>
              <div
                onClick={() => canExpand && toggle(l.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  cursor: canExpand ? 'pointer' : 'default', background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined,
                  opacity: l.status === 'QC_PASSED' && outstanding === 0 ? 0.75 : 1,
                }}
              >
                {canExpand
                  ? (isOpen ? <ChevronDown size={15} color="var(--text3)" /> : <ChevronRight size={15} color="var(--text3)" />)
                  : <span style={{ width: 15 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {l.materialName}
                    {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: RED, marginLeft: 8 }}><RotateCcw size={11} /> KCS trả về</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {l.status === 'ISSUED' || l.status === 'RECEIVED' ? l.barCount : baoCat} cây × {l.barLengthMm.toLocaleString('vi-VN')}mm
                  </div>
                </div>
                {l.status === 'ISSUED' ? (
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>chờ nhận</span>
                ) : l.status === 'RECEIVED' ? (
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>đang cắt</span>
                ) : l.status === 'IN_PROCESS' ? (
                  <span style={{ fontSize: 12, color: PURPLE, fontWeight: 600 }}>đang gia công</span>
                ) : l.status === 'AWAITING_QC' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS</span>
                ) : outstanding > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: RED }}>Lỗi {outstanding} đoạn</span>
                    {awaitingRecheck && <span style={{ color: AMBER }}>· chờ KCS duyệt lại</span>}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đạt</span>
                )}
              </div>

              {isOpen && (l.status === 'RECEIVED' || (l.status === 'QC_PASSED' && outstanding > 0)) && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface2)' }}>
                  <CutBatchPanel issue={l} readOnly={readOnly} progress={progressByMaterial.get(l.materialId) ?? null} review={review} onRefetch={refetchAll} onOpenCuttingGuide={onOpenCuttingGuide} />
                </div>
              )}

              {isOpen && l.status === 'IN_PROCESS' && !readOnly && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: PURPLE, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Wrench size={13} /> Còn thiếu công đoạn
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {l.requiredSteps.filter(s => !l.completedSteps.includes(s)).map(step => (
                      <button key={step} onClick={() => doCompleteStep(l, step)} disabled={busy === l.id}
                        style={{ ...smallBtn, background: PURPLE, cursor: busy === l.id ? 'not-allowed' : 'pointer' }}>
                        Xong {PROCESS_STEP_LABELS[step]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* IN_PROCESS vẫn cho bấm mở dòng dù chưa canExpand (chỉ RECEIVED mới canExpand) -
                  toggle riêng cho trạng thái này vì không có chevron ở header. */}
              {l.status === 'IN_PROCESS' && !isOpen && (
                <div style={{ padding: '0 16px 12px' }}>
                  <button onClick={() => toggle(l.id)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Xem công đoạn còn thiếu
                  </button>
                </div>
              )}

              {err[l.id] && <div style={{ padding: '0 16px 12px', fontSize: 12, color: RED }}>{err[l.id]}</div>}
            </div>
          )
        })}
        {rows.length === 0 && (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có đợt sắt nào</div>
        )}
      </div>
    </div>
  )
}

// ── Bảng Cần / Đã cắt / Lỗi / Còn lại + form nhập đợt cắt + lịch sử ──────
// RECEIVED (cắt lần đầu): đầy đủ form nhập đợt cắt + Gửi KCS. QC_PASSED còn lỗi (2026-08-24, vòng
// 2 - CHỈ 2 kết quả Đạt/Không đạt): chế độ XEM + nút "Bù đủ" mỗi cỡ đoạn - Phôi tự bù bằng sắt kiếm
// ngoài thực tế (KHÔNG đụng cây sắt kho đã cấp, KHÔNG qua recordCutBatch), CHỜ KCS duyệt lại mới
// hết lỗi (QcReviewsService.reportSegmentDone/recheck) - ẩn hẳn ô nhập đợt cắt/Gửi KCS ở chế độ này.
//
// "Cách cắt gợi ý" (2026-08-25, bỏ) - phương án cắt KHÔNG phải gợi ý, là BẮT BUỘC theo đúng
// solver đã duyệt. Bảng chip gọn khó nhìn khi nhiều cỡ và không in được, thay bằng liên kết sang
// màn riêng "Hướng dẫn cắt" (sidebar, HuongDanCatPage.tsx) - bảng lưới ô-theo-ô + xuất Excel.

function CutBatchPanel({ issue, readOnly, progress, review, onRefetch, onOpenCuttingGuide }: {
  issue: BeSteelIssue; readOnly: boolean; progress: BePhoiProgressItem | null
  review?: BeQcReview; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  const isRecheckMode = issue.status === 'QC_PASSED'
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({})
  const [barCount, setBarCount] = useState('')
  const [mauNguyen, setMauNguyen] = useState('')
  const [busy, setBusy] = useState(false)
  const [buDuBusy, setBuDuBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  // Luôn tải (không đợi mở "Lịch sử đợt đã nhập") - cần ngay để tính số cây còn lại bên dưới. Bỏ
  // qua ở chế độ duyệt bù (isRecheckMode) - không còn ô nhập đợt cắt nào cần số cây còn lại.
  const { data: bundles, refetch: refetchBundles } = useFetch<BeCutBundle[]>(
    () => isRecheckMode ? Promise.resolve([]) : api.getCutBundles(issue.id),
    [isRecheckMode, issue.id],
  )

  const segments = progress?.segments ?? []
  const doneEnough = segments.length > 0 && segments.every(s => s.done >= s.required)
  // Map từ ĐÚNG review của issue này (không phải PI-wide) - "Bù đủ" chỉ tác động phần lỗi CHÍNH
  // đợt sắt này đã bị KCS chấm, dù cột "Lỗi" hiển thị bên dưới là tổng PI-wide (cùng quy ước với
  // Cần/Đã cắt/Còn lại - đã vậy từ trước, không phải điểm mới ở đây).
  const reviewSegBySpec = new Map((review?.segments ?? []).map(s => [s.segmentSpecId, s]))
  const usedBarCount = bundles?.reduce((s, b) => s + b.barCount, 0) ?? 0
  const remainingBarCount = issue.barCount - usedBarCount

  const submit = async () => {
    const rows = segments
      .map(s => ({ segmentSpecId: s.segmentSpecId, qty: Math.floor(Number(rowInputs[s.segmentSpecId]) || 0) }))
      .filter(r => r.qty > 0)
    const cay = Math.floor(Number(barCount) || 0)
    if (cay <= 0) { setErr('Nhập số cây đã dùng cho đợt này'); return }
    if (rows.length === 0) { setErr('Nhập ít nhất 1 cỡ đoạn đã cắt được'); return }
    setBusy(true); setErr('')
    try {
      await api.recordCutBatch(issue.id, {
        barCount: cay,
        mauNguyenMm: mauNguyen ? Math.floor(Number(mauNguyen)) || 0 : undefined,
        segments: rows,
      })
      setRowInputs({}); setBarCount(''); setMauNguyen('')
      onRefetch()
      refetchBundles()
    } catch (e) { setErr(errMsg(e, 'Không lưu được đợt cắt - kiểm lại số liệu')) }
    finally { setBusy(false) }
  }

  const doFinish = async () => {
    setBusy(true); setErr('')
    try { await api.finishCutting(issue.id); onRefetch() }
    catch (e) { setErr(errMsg(e, 'Không mời KCS được')) }
    finally { setBusy(false) }
  }

  const doBuDu = async (segmentSpecId: string) => {
    setBuDuBusy(segmentSpecId); setErr('')
    try { await api.reportSegmentDone(issue.id, segmentSpecId); onRefetch() }
    catch (e) { setErr(errMsg(e, 'Không báo được')) }
    finally { setBuDuBusy(null) }
  }

  if (!progress) return <LoadingState />

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
        {isRecheckMode ? 'Cỡ đoạn không đạt - tự bù bằng sắt kiếm ngoài thực tế:' : 'Cần cắt theo định mức lệnh này:'}
      </div>
      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã cắt</th>
              <th style={thR}>Lỗi</th>
              <th style={thR}>Còn lại</th>
              {!readOnly && isRecheckMode && <th style={{ ...thR, width: 140 }}>Xử lý</th>}
              {!readOnly && !isRecheckMode && <th style={{ ...thR, width: 100 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            {segments.map(s => {
              const remaining = s.required - (s.done - s.failed)
              const reviewSeg = reviewSegBySpec.get(s.segmentSpecId)
              const reviewOutstanding = reviewSeg ? reviewSeg.failedQty - reviewSeg.resolvedQty : 0
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.required}</td>
                  <td style={tdR}>{s.done}</td>
                  <td style={{ ...tdR, color: s.failed > 0 ? RED : 'var(--text3)' }}>{s.failed > 0 ? s.failed : '—'}</td>
                  <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining > 0 ? remaining : 0}</td>
                  {!readOnly && isRecheckMode && (
                    <td style={{ ...td, textAlign: 'right' }}>
                      {reviewOutstanding > 0 && (
                        reviewSeg?.phoiReportedAt ? (
                          <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>chờ KCS duyệt lại</span>
                        ) : (
                          <button onClick={() => doBuDu(s.segmentSpecId)} disabled={buDuBusy === s.segmentSpecId}
                            style={{ ...smallBtn, background: ACCENT, cursor: buDuBusy === s.segmentSpecId ? 'not-allowed' : 'pointer' }}>
                            {buDuBusy === s.segmentSpecId ? '...' : 'Bù đủ'}
                          </button>
                        )
                      )}
                    </td>
                  )}
                  {!readOnly && !isRecheckMode && (
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" min={0} placeholder="0" value={rowInputs[s.segmentSpecId] ?? ''}
                        onChange={e => setRowInputs(r => ({ ...r, [s.segmentSpecId]: e.target.value }))}
                        style={inp} />
                    </td>
                  )}
                </tr>
              )
            })}
            {segments.length === 0 && (
              <tr><td colSpan={readOnly ? 5 : 6} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Chưa xác định được định mức cho loại sắt này
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && !isRecheckMode && segments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              Số cây đã dùng
              {bundles !== null && (
                <span style={{ fontWeight: 700, color: remainingBarCount > 0 ? GREEN : RED }}>
                  {remainingBarCount > 0 ? `còn ${remainingBarCount} cây` : 'hết cây'}
                </span>
              )}
            </div>
            <input type="number" min={1} max={Math.max(remainingBarCount, 0) || undefined} value={barCount}
              onChange={e => setBarCount(e.target.value)}
              style={{ ...inp, width: 64, borderColor: remainingBarCount <= 0 ? RED : undefined }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Mẩu nguyên (mm)</div>
            <input type="number" min={0} placeholder="0" value={mauNguyen} onChange={e => setMauNguyen(e.target.value)} style={{ ...inp, width: 84 }} />
          </div>
          <button onClick={submit} disabled={busy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Plus size={13} /> {busy ? '...' : 'Lưu đợt cắt'}
          </button>
          <button onClick={doFinish} disabled={busy}
            style={{
              ...smallBtn, cursor: busy ? 'not-allowed' : 'pointer',
              background: doneEnough ? GREEN : 'var(--surface)',
              color: doneEnough ? '#fff' : 'var(--text2)',
              border: doneEnough ? 'none' : '1px solid var(--border)',
            }}>
            {busy ? '...' : 'Gửi KCS'}
          </button>
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}

      {!isRecheckMode && onOpenCuttingGuide && (
        <button onClick={() => onOpenCuttingGuide(issue.productionInvoiceId)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, marginBottom: 10, fontSize: 12, fontWeight: 600, color: ACCENT, cursor: 'pointer' }}>
          <Ruler size={13} /> Xem hướng dẫn cắt đầy đủ (bắt buộc theo đúng phương án đã duyệt, xuất được để in) →
        </button>
      )}

      {!isRecheckMode && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => setShowHistory(x => !x)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Lịch sử đợt đã nhập
          </button>
          {showHistory && (
            <div style={{ ...card, padding: '10px 14px' }}>
              {(bundles ?? []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa nhập đợt cắt nào.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(bundles ?? []).map(b => (
                    <div key={b.id} style={{ fontSize: 12 }}>
                      <b>{b.barCount}</b> cây → {b.segments.map(s => `${s.qty}×${s.cutLengthMm}mm`).join(' + ')}
                      {b.mauNguyenMm > 0 && <span style={{ color: 'var(--text3)' }}> · mẩu nguyên {b.mauNguyenMm}mm</span>}
                      <span style={{ color: 'var(--text3)' }}> · phế {b.scrapMm}mm</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
