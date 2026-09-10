'use client'

/**
 * Màn hình KCS — Công đoạn PHÔI (2 tầng: PI → các đợt chờ kiểm).
 *
 * Viết lại hoàn toàn (2026-08-24) — KHÔNG còn dùng chung `kcsCore.tsx`/`KcsTwoTierScreen` với
 * Hàn/Sơn nữa: Sếp chốt Phôi chấm THEO TỪNG CỠ ĐOẠN (khác Hàn/Sơn vẫn chấm cả lô theo số lượng
 * đơn thuần - production_batch chưa có "cỡ" gì để bóc). Tách riêng để không đụng kcsCore.tsx
 * (Hàn/Sơn dùng, không được vỡ).
 *
 * KCS chỉ chấm 2 kết quả: Đạt/Không đạt (2026-08-24, vòng 2 - bỏ hẳn "lỗi sửa được" đã thử ở vòng
 * 1). Đợt đóng QC_PASSED ngay.
 *
 * Redesign 2026-09-05 (chấm theo ĐỢT CẮT thay vì cả LÔ NHẬN): trước đây 1 lô nhận (SteelIssue)
 * chỉ có đúng 1 lượt "báo cắt xong" nên chấm theo issue = chấm đúng đợt. Từ khi trạng thái hạ
 * xuống CutBundle (mỗi lần Phôi bấm "Lưu đợt cắt" tự có vòng đời riêng, xem LenhSanXuatPhoi.tsx),
 * 1 lô nhận có thể có NHIỀU đợt cắt cùng lúc đang AWAITING_QC - phải chấm theo TỪNG bundle, không
 * còn theo issue. `QcReviewModal` giờ nhận thẳng `bundle` (segments đã có sẵn trong chính bundle,
 * không cần gọi lại API gộp nhiều bundle như bản issue-based cũ).
 *
 * Redesign 2026-09-07 (thêm StepBundle - chấm CÔNG ĐOẠN PHỤ riêng): mỗi PI giờ có thể có NHIỀU
 * "đợt gửi KCS công đoạn phụ" (Uốn/Dập/Tán/...) độc lập theo TỪNG LOẠI SẮT, KHÔNG chờ Cắt hay công
 * đoạn khác xong trước (xem StepBundle doc comment BE). `Row` gộp CẢ 2 loại đợt (Cắt lẫn công đoạn
 * phụ) thành 1 danh sách chờ kiểm chung cho từng PI - `QcReviewModal` tổng quát hoá (nhận
 * `id`/`segments`/`onReview` thay vì bám cứng `bundle`) để dùng chung cho cả 2 loại, tránh chép lại
 * nguyên modal.
 *
 * Redesign 2026-09-08 (StepBundle chuyển PI-wide, bỏ report-done/recheck): StepBundle không còn
 * gắn với đúng 1 CutBundle nào nữa (scope PI + loại sắt, xem LenhSanXuatPhoi.tsx/BeStepBundle) —
 * `StepRow` giờ lấy thẳng từ `api.getAllStepBundles()`, không còn duyệt qua `bundle.stepBundles`.
 * Đồng thời BỎ HẲN cơ chế "Bù đủ → KCS duyệt lại" (report-done/recheck) cho cả Cắt lẫn StepBundle:
 * "Lỗi" giờ là số lịch sử KHÔNG tự giảm, "Bù đủ" chỉ là nút pre-fill số lượng bên LenhSanXuatPhoi.tsx
 * rồi gửi 1 đợt HOÀN TOÀN MỚI qua đúng luồng bình thường — nên mọi đợt (Cắt lẫn công đoạn phụ) giờ
 * chỉ còn ĐÚNG 1 lượt duyệt qua `QcReviewModal`, không còn "chờ duyệt lại"/`RecheckModal` nữa.
 *
 * Redesign 2026-09-08 (lần 2, theo góp ý người dùng "màn KCS cũng làm tab theo công đoạn"): bảng
 * chờ duyệt trong `PiDetail` trước đây XỔ CHUNG mọi công đoạn (Cắt lẫn Uốn/Dập/... trộn lẫn theo
 * hàng, chỉ phân biệt qua cột "Công đoạn") - giờ tách thành TAB bấm chuyển qua lại (mirror
 * `MaterialGroupDetail` bên `LenhSanXuatPhoi.tsx` đã làm), mỗi tab chỉ hiện đúng đợt của công đoạn
 * đó + số đang chờ kiểm ngay trên nút tab - tab mặc định chọn công đoạn có nhiều đợt chờ nhất. Bỏ
 * luôn cột "Công đoạn" khỏi bảng (đã ngầm hiểu qua tab đang chọn, không cần lặp lại mỗi hàng).
 *
 * Redesign 2026-09-08 (lần 3, theo góp ý người dùng "sao lại đưa VTTP ra ngoài, sao không đưa vào
 * trong Phôi luôn"): bên `tkphoi` (LenhSanXuatPhoi.tsx) đã gộp Sắt + Vật tư TP vào 1 màn "Lệnh sản
 * xuất — Công đoạn Phôi" từ lâu (tab "Cắt sắt"/"Vật tư TP"), nhưng bên KCS lại tách "Phôi"/"Vật tư
 * TP" thành 2 mục nav riêng (MfgApp.tsx: 'kcs-phoi'/'kcs-vat-tu-tp') - không nhất quán. Gộp NHANH
 * (theo yêu cầu, không viết lại sâu): bỏ hẳn mục nav 'kcs-vat-tu-tp' riêng, `KcsPhoiPage` giờ tự có
 * dải tab "Cắt sắt"/"Vật tư TP" ở ĐẦU màn (`section` state) - tab "Vật tư TP" render NGUYÊN
 * `KcsVatTuThanhPhamPage` cũ (đổi tên `KcsSatSection` cho phần Sắt gốc, không đổi logic bên trong -
 * chỉ đổi VỊ TRÍ truy cập, 2 luồng dữ liệu vẫn hoàn toàn độc lập như trước).
 */

import { useMemo, useState } from 'react'
import { ClipboardCheck, Check, Clock, ChevronLeft, ChevronRight, AlertTriangle, Upload, X, Plus, Wrench } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview, BeCutBundle, BeStepBundle } from '../../../services/steel-issues-api'
import type { BeDefectReason } from '../../../services/defect-reasons-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import KcsVatTuThanhPhamPage from './KcsVatTuThanhPhamPage'

const ACCENT = '#e65100'
const GREEN = '#16a34a'
const RED = '#c62828'
const AMBER = '#d97706'
const tabBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, #fff3e8)' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})
const tabPendingBadge: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
  borderRadius: 8, fontSize: 10.5, fontWeight: 700, background: AMBER, color: '#fff',
}
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

interface PiAgg { productionInvoiceId: string; poNumber: string; bundles: Row[]; pendingCount: number }
/** 1 đợt cắt kèm lô nhận cha (để hiện materialName/barLengthMm - bundle tự nó không có tên vật tư). */
interface CutRow { kind: 'cut'; bundle: BeCutBundle; issue: BeSteelIssue }
/** 1 đợt gửi KCS công đoạn PHỤ (2026-09-08, PI-wide) - StepBundle tự mang đủ
 *  productionInvoiceId/materialName, không cần cutBundle/issue cha nữa. */
interface StepRow { kind: 'step'; stepBundle: BeStepBundle }
type Row = CutRow | StepRow

function piIdOf(x: Row): string { return x.kind === 'cut' ? x.issue.productionInvoiceId : x.stepBundle.productionInvoiceId }
function materialNameOf(x: Row): string { return x.kind === 'cut' ? x.issue.materialName : x.stepBundle.materialName }
function idOf(x: Row): string { return x.kind === 'cut' ? x.bundle.id : x.stepBundle.id }
function statusOf(x: Row): 'CUTTING' | 'AWAITING_QC' | 'QC_PASSED' { return x.kind === 'cut' ? x.bundle.status : x.stepBundle.status }
function completedAtOf(x: Row): string { return x.kind === 'cut' ? (x.bundle.completedAt ?? x.bundle.createdAt) : x.stepBundle.submittedAt }
function segmentsOf(x: Row): { segmentSpecId: string; cutLengthMm: number; qty: number }[] {
  return x.kind === 'cut' ? x.bundle.segments : x.stepBundle.segments
}

function buildPiRows(issues: BeSteelIssue[], bundles: BeCutBundle[], stepBundles: BeStepBundle[]): PiAgg[] {
  const issueById = new Map(issues.map((i) => [i.id, i]))
  // poNumber tra theo productionInvoiceId (không còn dùng issue của chính Row vì StepRow không có
  // issue cha nữa) - lấy từ bất kỳ issue nào cùng PI, đều cùng 1 piCode. 2026-09-10 (theo yêu cầu
  // người dùng): màn KCS LUÔN hiện mã PI, KHÔNG hiện mã PO (đơn hàng Sales) - trước đây ưu tiên PO
  // nếu có, dễ nhầm với "PO" ở màn Mua hàng/Kho (2 mã khác nhau cùng gọi là "PO") - cùng đổi với
  // Hàn/Sơn/Vật tư TP (KcsStagePage.tsx).
  const poNumberByPi = new Map<string, string>()
  for (const i of issues) {
    if (!poNumberByPi.has(i.productionInvoiceId)) poNumberByPi.set(i.productionInvoiceId, i.piCode)
  }
  // Chỉ đợt liên quan KCS (đã báo cắt xong / đã gửi KCS trở lên) - đợt còn CUTTING hoặc công đoạn
  // phụ chưa gửi chưa liên quan.
  const cutRows: Row[] = bundles
    .filter((b) => b.status === 'AWAITING_QC' || b.status === 'QC_PASSED')
    .map((b) => ({ kind: 'cut' as const, bundle: b, issue: issueById.get(b.steelIssueId) }))
    .filter((x): x is CutRow => x.issue != null)
  const stepRows: Row[] = stepBundles
    .filter((sb) => sb.status === 'AWAITING_QC' || sb.status === 'QC_PASSED')
    .map((sb) => ({ kind: 'step' as const, stepBundle: sb }))
  const relevant = [...cutRows, ...stepRows]
  const byPi = new Map<string, Row[]>()
  const order: string[] = []
  for (const x of relevant) {
    const piId = piIdOf(x)
    if (!byPi.has(piId)) { byPi.set(piId, []); order.push(piId) }
    byPi.get(piId)!.push(x)
  }
  return order
    .map((productionInvoiceId) => {
      const list = byPi.get(productionInvoiceId)!
      const pendingCount = list.filter((x) => statusOf(x) === 'AWAITING_QC').length
      return {
        productionInvoiceId,
        poNumber: poNumberByPi.get(productionInvoiceId) ?? productionInvoiceId,
        bundles: list,
        pendingCount,
      }
    })
    .sort((a, b) => b.pendingCount - a.pendingCount)
}

const sectionTabBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '7px 14px', fontSize: 13, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, #fff3e8)' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})

export default function KcsPhoiPage() {
  const [section, setSection] = useState<'sat' | 'vattutp'>('sat')

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setSection('sat')} style={sectionTabBtn(section === 'sat')}>Cắt sắt</button>
        <button onClick={() => setSection('vattutp')} style={sectionTabBtn(section === 'vattutp')}>Vật tư TP</button>
      </div>
      {section === 'sat' ? <KcsSatSection /> : <KcsVatTuThanhPhamPage />}
    </div>
  )
}

function KcsSatSection() {
  const { data: issues, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: allBundles, refetch: refetchBundles } = useFetch<BeCutBundle[]>(() => api.getAllCutBundles(), [])
  const { data: allStepBundles, refetch: refetchStepBundles } = useFetch<BeStepBundle[]>(() => api.getAllStepBundles(), [])
  const { data: reviews, refetch: refetchReviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [selPi, setSelPi] = useState<string | null>(null)

  const piRows = useMemo(
    () => buildPiRows(issues ?? [], allBundles ?? [], allStepBundles ?? []),
    [issues, allBundles, allStepBundles],
  )
  const refetchAll = () => { refetch(); refetchBundles(); refetchStepBundles(); refetchReviews() }

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
        Kiểm tra chất lượng theo từng cỡ đoạn — bấm vào PI có đợt chờ kiểm để duyệt.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PI</th>
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

/** Định danh 1 công đoạn trong tab: 'CAT' (Cắt) hoặc đúng `ProcessStep` của StepRow. */
function stepKeyOf(x: Row): 'CAT' | ProcessStep { return x.kind === 'cut' ? 'CAT' : x.stepBundle.step }

function PiDetail({ pi, reviews, onBack, onRefetch }: {
  pi: PiAgg; reviews: BeQcReview[]; onBack: () => void; onRefetch: () => void
}) {
  const [target, setTarget] = useState<Row | null>(null)

  const reviewByBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.cutBundleId) m.set(r.cutBundleId, r)
    return m
  }, [reviews])
  const reviewByStepBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.stepBundleId) m.set(r.stepBundleId, r)
    return m
  }, [reviews])

  const reviewOf = (x: Row) => x.kind === 'cut' ? reviewByBundle.get(x.bundle.id) : reviewByStepBundle.get(x.stepBundle.id)

  // Danh sách công đoạn xuất hiện trong PI này (Cắt luôn trước, còn lại theo thứ tự gặp trong dữ
  // liệu) + số đợt đang chờ kiểm mỗi công đoạn - dùng để dựng dải tab và badge số chờ trên từng tab.
  const stepKeys = useMemo(() => {
    const seen = new Set<string>()
    const keys: ('CAT' | ProcessStep)[] = []
    for (const x of pi.bundles) {
      const k = stepKeyOf(x)
      if (!seen.has(k)) { seen.add(k); keys.push(k) }
    }
    return keys
  }, [pi.bundles])
  const pendingByStep = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of pi.bundles) {
      if (statusOf(x) === 'AWAITING_QC') { const k = stepKeyOf(x); m.set(k, (m.get(k) ?? 0) + 1) }
    }
    return m
  }, [pi.bundles])
  // Mặc định mở đúng công đoạn đang chờ NHIỀU nhất (đỡ phải tự bấm tìm) - chỉ tính lúc mount, đổi
  // tab sau đó là quyền người dùng, không tự nhảy khi refetch.
  const [activeStep, setActiveStep] = useState<'CAT' | ProcessStep>(() => {
    let best: 'CAT' | ProcessStep = stepKeys[0] ?? 'CAT'
    let bestPending = -1
    for (const k of stepKeys) {
      const p = pendingByStep.get(k) ?? 0
      if (p > bestPending) { bestPending = p; best = k }
    }
    return best
  })
  const effectiveActiveStep = stepKeys.includes(activeStep) ? activeStep : (stepKeys[0] ?? 'CAT')

  const rank = (x: Row) => statusOf(x) === 'AWAITING_QC' ? 0 : 1
  const rows = pi.bundles
    .filter((x) => stepKeyOf(x) === effectiveActiveStep)
    .sort((a, b) => {
      const r = rank(a) - rank(b)
      return r !== 0 ? r : completedAtOf(b).localeCompare(completedAtOf(a))
    })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
      </div>

      {stepKeys.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {stepKeys.map((k) => {
            const label = k === 'CAT' ? 'Cắt' : PROCESS_STEP_LABELS[k]
            const pending = pendingByStep.get(k) ?? 0
            return (
              <button key={k} onClick={() => setActiveStep(k)} style={tabBtn(k === effectiveActiveStep)}>
                {label}
                {pending > 0 && <span style={tabPendingBadge}>{pending}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Loại sắt</th>
              <th style={th}>Đợt</th>
              <th style={th}>Gửi KCS lúc</th>
              <th style={{ ...th, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...th, width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const id = idOf(x)
              const status = statusOf(x)
              const segments = segmentsOf(x)
              const review = reviewOf(x)
              // failedQty giờ là số ĐOẠN lịch sử của ĐÚNG đợt này - KHÔNG tự giảm (không còn khái
              // niệm "duyệt lại"/outstanding, xem doc comment đầu file 2026-09-08). Đợt QC_PASSED
              // có lỗi lịch sử vẫn hiện "đạt" - Phôi bù bằng 1 đợt MỚI riêng nếu cần.
              const totalFailed = (review?.segments ?? []).reduce((s, y) => s + y.failedQty, 0)
              return (
                <tr key={`${x.kind}:${id}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{materialNameOf(x)}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>
                    {segments.map((s) => `${s.qty}×${s.cutLengthMm.toLocaleString('vi-VN')}mm`).join(' + ')}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(completedAtOf(x)).toLocaleString('vi-VN')}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {status === 'AWAITING_QC' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ kiểm</span>
                    ) : totalFailed > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                        <Check size={12} color={GREEN} /> <span style={{ color: GREEN }}>đạt</span>
                        <span style={{ color: RED, fontWeight: 600 }}>(lỗi {totalFailed} đoạn)</span>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đạt</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {status === 'AWAITING_QC' && (
                      <button onClick={() => setTarget(x)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
                        <ClipboardCheck size={13} /> Tiến hành duyệt
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Không có đợt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <QcReviewModal
          id={idOf(target)} materialName={materialNameOf(target)} segments={segmentsOf(target)}
          onReview={(id, data) => target.kind === 'cut' ? api.reviewCutBundleQc(id, data) : api.reviewStepBundleQc(id, data)}
          onClose={() => setTarget(null)} onDone={() => { setTarget(null); onRefetch() }}
        />
      )}
    </div>
  )
}

// ── Modal duyệt: nhập lỗi THEO TỪNG CỠ ĐOẠN của chính ĐỢT (Cắt hoặc công đoạn phụ) này ────────
// (2026-09-05) segments đã có sẵn trong đợt (không còn gọi getCutBundles()/aggregate nhiều bundle
// như bản issue-based cũ - 1 đợt giờ CHÍNH LÀ đơn vị chấm, không cần gộp). Tổng quát hoá
// (2026-09-07) nhận `id`/`segments`/`onReview` thay vì bám cứng `bundle` - dùng chung được cho cả
// CutBundle (Cắt) lẫn StepBundle (công đoạn phụ), 2 nhánh chỉ khác API đích (onReview).

function QcReviewModal({ id, materialName, segments, onReview, onClose, onDone }: {
  id: string; materialName: string
  segments: { segmentSpecId: string; cutLengthMm: number; qty: number }[]
  onReview: (id: string, data: {
    segments: { segmentSpecId: string; failedQty: number }[]
    defectReasonId?: string; reason?: string; photoUrl?: string
  }) => Promise<void>
  onClose: () => void; onDone: () => void
}) {
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

  const list = reasons ?? []

  const rows = segments.map((s) => {
    const raw = Math.floor(Number(failedByseg[s.segmentSpecId]) || 0)
    const failed = Math.max(0, Math.min(s.qty, raw))
    return { segmentSpecId: s.segmentSpecId, cutLengthMm: s.cutLengthMm, cutQty: s.qty, failed }
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
      await onReview(id, {
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
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tiến hành duyệt — {materialName}</h3>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>

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
                <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Đợt này chưa khai đoạn nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

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
          <button onClick={submit} disabled={busy || uploading}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? '...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
  )
}
