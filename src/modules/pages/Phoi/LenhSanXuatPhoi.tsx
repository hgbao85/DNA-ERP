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
 * động độc lập: nhập từng đợt (nhiều lần, cộng dồn) + "Báo cắt xong" (tín hiệu thuần, không mang
 * số liệu, KHÔNG tự động khi Còn lại = 0 vì ca cắt thiếu do sắt hỏng/cong vẫn phải đi tiếp được).
 * Đổi nhãn nút từ "Gửi KCS" → "Báo cắt xong" (2026-08-27): tên cũ gây hiểu nhầm khi vật tư còn
 * công đoạn phụ (Uốn/Dập/...) - bấm xong chỉ chuyển "đang gia công", CHƯA thật sự qua KCS.
 *
 * KCS chấm lỗi (2026-08-24, vòng 2): CHỈ 2 kết quả Đạt/Không đạt. Đợt QC_PASSED còn lỗi (outstanding
 * > 0) vẫn mở ra xem được bảng Cần/Đã cắt/Lỗi/Còn lại, nhưng KHÔNG còn ô nhập đợt cắt - Phôi tự bù
 * bằng sắt kiếm ngoài thực tế (KHÔNG đụng cây sắt kho đã cấp), bấm "Bù đủ" rồi CHỜ KCS duyệt lại
 * (QcReviewsService.reportSegmentDone/recheck) mới hết lỗi.
 *
 * Redesign 2026-08-26: PI vẫn là đơn vị lớn nhất (SteelIssue không theo dõi theo SKU/mảnh - xem
 * changelog 2026-08-19-xuat-sat-theo-pi-hoan-tat.html). Thêm khối "PO/SKU trong đợt này" ở
 * PiDetail (THUẦN THAM KHẢO, không có số liệu tiến độ riêng theo SKU - dữ liệu đó không tồn tại
 * thật). Đổi "Đã KCS đạt" → "Đã phôi" (chỉ ở màn Phôi, không đụng KcsPhoiPage) - tách bạch với
 * "Đã cắt" (thô, chưa chắc đã xong Uốn/Dập nếu vật tư cần). Gộp trang "Thống kê công đoạn"
 * (ThongKeCongDoanPage.tsx cũ, đã xoá) làm 1 view-toggle riêng ở đây (CongDoanView).
 *
 * Bỏ view-toggle đó (2026-08-27, vòng 4): "Theo công đoạn" tự ẩn PI đã xong hết (không còn cách
 * xem lại), và tách rời khỏi thao tác "Xong {bước}" nên phải nhảy 2 màn mới đánh dấu được.
 *
 * Nhập số lượng thật cho từng công đoạn phụ (2026-08-27, vòng 2 cùng ngày): thêm bảng StepBatch/
 * StepBatchSegment (BE, mirror CutBundle) + endpoint getStepProgress/recordStepBatch - Uốn/Dập/...
 * giờ có bảng Cần/Đã.../Còn lại + ô nhập số lượng thật y hệt Cắt, không còn chỉ có nút "Xong" trần.
 *
 * Chi tiết 1 đợt sắt tách thành màn riêng IssueDetail (2026-08-27, vòng 7): trước đó bấm 1 dòng
 * loại sắt chỉ bung ngay trong danh sách PiDetail - nhiều dòng mở cùng lúc gây cảm giác "ảnh hưởng
 * lẫn nhau". Giờ bấm 1 dòng ĐIỀU HƯỚNG sang IssueDetail riêng (đúng pattern PI list → PiDetail),
 * độc lập hoàn toàn với các loại sắt khác. Trong IssueDetail, dải tab lọc theo ĐÚNG TÊN công đoạn
 * (Cắt/Uốn/Tóp đầu/...) - tab nào đã xong có dấu ✓ (vòng 8, cùng ngày) - "Tất cả" xem gộp mọi mục.
 */

import { useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Wrench, Clock, Check, AlertTriangle, RotateCcw, Plus, Ruler,
} from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type {
  BeSteelIssue, BeQcReview, BePhoiProgressItem, BeCutBundle, BePiOrderSummary,
} from '../../../services/steel-issues-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../constants/processSteps'
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
const subFilterBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, #fff3e8)' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})

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
    // "Đã phôi" tính theo CÂY (đợt đã duyệt xong, status QC_PASSED) - KHÔNG trừ failedByIssue
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
              <th style={thR}>Đã phôi</th>
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
  // Chi tiết 1 đợt sắt (2026-08-27, vòng 7): trước đó bấm 1 dòng chỉ BUNG RA NGAY TRONG danh
  // sách - nhiều dòng có thể cùng mở, dòng nọ đẩy vị trí dòng kia, cảm giác "ảnh hưởng lẫn nhau"
  // giữa các loại sắt. Giờ bấm 1 dòng ĐIỀU HƯỚNG sang màn chi tiết riêng (IssueDetail) - đúng
  // pattern PI list → PiDetail đã có, chỉ thêm 1 tầng: PiDetail (danh sách loại sắt) → IssueDetail
  // (nội dung 1 loại sắt, độc lập hoàn toàn với các loại khác).
  const [selIssueId, setSelIssueId] = useState<string | null>(null)
  // Công đoạn chi tiết SAU Cắt đọc từ StepBatchSegment (getStepProgress/recordStepBatch) - tải
  // tiến độ MỌI công đoạn active 1 lần ở đây (không phải theo tab, xem IssueDetail) để mỗi đợt
  // sắt tự tra đúng (vật tư, bước) của nó khi mở màn chi tiết riêng.
  const activeSteps = useMemo(
    () => PROCESS_STEPS.filter(step => step !== 'CAT' && pi.issues.some(i => i.requiredSteps.includes(step))),
    [pi.issues],
  )
  const activeStepsKey = activeSteps.join(',')

  const { data: progress, refetch: refetchProgress } = useFetch<BePhoiProgressItem[]>(
    () => api.getPhoiProgress(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  // Tải tiến độ MỌI công đoạn active 1 lần (không phải theo tab chọn - không còn tab) để mỗi dòng
  // tự tra đúng (vật tư, bước) của nó khi bung ra nhiều bảng cùng lúc.
  const { data: stepProgressList, refetch: refetchStepProgress } = useFetch<[ProcessStep, BePhoiProgressItem[]][]>(
    () => activeSteps.length === 0 ? Promise.resolve([]) : Promise.all(
      activeSteps.map(step => api.getStepProgress(pi.productionInvoiceId, step).then(data => [step, data] as [ProcessStep, BePhoiProgressItem[]])),
    ),
    [pi.productionInvoiceId, activeStepsKey],
  )
  const stepProgressByStep = useMemo(() => {
    const m = new Map<ProcessStep, BePhoiProgressItem[]>()
    for (const [step, data] of stepProgressList ?? []) m.set(step, data)
    return m
  }, [stepProgressList])
  const getStepProgressItem = (materialId: string, step: ProcessStep) =>
    (stepProgressByStep.get(step) ?? []).find(item => item.materialId === materialId) ?? null
  // Khối "PO/SKU trong đợt này" - THUẦN THAM KHẢO, không mang số liệu tiến độ (tiến độ chỉ có ở
  // cấp PI × loại sắt, xem progress ở trên) - Phôi không biết trước cây sắt về SKU nào lúc cắt.
  // Luôn hiện kể cả PI thường (1 SKU) để đồng nhất giao diện.
  const { data: orderSummary } = useFetch<BePiOrderSummary[]>(
    () => api.getPiOrderSummary(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  const progressByMaterial = useMemo(() => {
    const m = new Map<string, BePhoiProgressItem>()
    for (const p of progress ?? []) m.set(p.materialId, p)
    return m
  }, [progress])
  // Nhập đợt cắt/mời KCS đổi cả phoi-progress (Cần/Đã cắt) lẫn steel-issues/qc-reviews (trạng
  // thái) - phải refetch cả 2 nguồn (+ step-progress mọi công đoạn), không chỉ mỗi onRefetch() của cha.
  const refetchAll = () => { onRefetch(); refetchProgress(); refetchStepProgress() }

  const reviewByIssue = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.steelIssueId) m.set(r.steelIssueId, r)
    return m
  }, [reviews])

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

  const selIssue = selIssueId ? rows.find(r => r.id === selIssueId) ?? null : null
  if (selIssue) {
    return (
      <IssueDetail
        key={selIssue.id} issue={selIssue} readOnly={readOnly} review={reviewByIssue.get(selIssue.id)}
        progressByMaterial={progressByMaterial} getStepProgressItem={getStepProgressItem}
        onBack={() => setSelIssueId(null)} onRefetch={refetchAll} onOpenCuttingGuide={onOpenCuttingGuide}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
      </div>

      <div style={{ ...card, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>Đợt cắt này gồm</div>
        {!orderSummary ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div>
        ) : orderSummary.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có dữ liệu.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {orderSummary.map((o, i) => (
              <div key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.poNumber}</span>
                <span>{o.productName}</span>
                <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>SL {o.quantity.toLocaleString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>cắt lại</b> · tổng <b>{traVeCay}</b> cây.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(l => {
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
          // Mọi trạng thái sau "chờ nhận" đều xem chi tiết được - chỉ ISSUED chưa có gì để xem.
          const canOpen = l.status !== 'ISSUED'
          return (
            <div key={l.id} style={{ ...card, borderColor: isReturn ? RED : undefined }}>
              <div
                onClick={() => canOpen && setSelIssueId(l.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  cursor: canOpen ? 'pointer' : 'default', background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined,
                  opacity: l.status === 'QC_PASSED' && outstanding === 0 ? 0.75 : 1,
                }}
              >
                {canOpen ? <ChevronRight size={15} color="var(--text3)" /> : <span style={{ width: 15 }} />}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
                    {l.requiredSteps.filter(s => s !== 'CAT' && !l.completedSteps.includes(s)).map(step => (
                      <span key={step} style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {PROCESS_STEP_LABELS[step]}
                      </span>
                    ))}
                  </div>
                ) : l.status === 'AWAITING_QC' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS</span>
                ) : outstanding > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: RED }}>Lỗi {outstanding} đoạn</span>
                    {awaitingRecheck && <span style={{ color: AMBER }}>· chờ KCS duyệt lại</span>}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã phôi</span>
                )}
              </div>
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

// ── Chi tiết 1 đợt sắt (2026-08-27, vòng 7) — độc lập hoàn toàn với các loại sắt khác trong
// cùng PI, không còn bung ngay trong danh sách (xem comment ở PiDetail). Lọc theo ĐÚNG TÊN công
// đoạn (vòng 8) - Cắt/Uốn/Tóp đầu/... mỗi cái 1 tab riêng, tab nào đã xong có dấu ✓; "Tất cả" xem
// gộp mọi mục cùng lúc. Không còn kiểu thu gọn-sau-chevron của vòng 6 (bấm mới xem) - đã bỏ vì
// vẫn phải bấm thêm 1 lần cho mỗi mục muốn xem lại.
function IssueDetail({ issue, readOnly, review, progressByMaterial, getStepProgressItem, onBack, onRefetch, onOpenCuttingGuide }: {
  issue: BeSteelIssue; readOnly: boolean; review?: BeQcReview
  progressByMaterial: Map<string, BePhoiProgressItem>
  getStepProgressItem: (materialId: string, step: ProcessStep) => BePhoiProgressItem | null
  onBack: () => void; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Lọc theo TỪNG công đoạn cụ thể (2026-08-27, vòng 8) - trước đó phần đã xong thu gọn sau
  // chevron, bấm mới xem được; giờ bỏ hẳn chevron, chọn đúng tên công đoạn (Cắt/Uốn/Tóp đầu/...)
  // ở tab để chỉ xem/nhập đúng 1 mục đó, "Tất cả" xem gộp như cũ. Khoá theo item.key ('CAT' hoặc
  // ProcessStep).
  const [subFilter, setSubFilter] = useState<string>('all')

  const segs = review?.segments ?? []
  const outstanding = segs.reduce((s, x) => s + (x.failedQty - x.resolvedQty), 0)
  const awaitingRecheck = segs.some((x) => x.phoiReportedAt != null && x.failedQty - x.resolvedQty > 0)
  const isReturn = issue.status === 'RECEIVED' && !!issue.reworkOfId
  const baoCat = issue.actualBarCount ?? issue.barCount

  const doCompleteStep = async (step: ProcessStep) => {
    setBusy(true); setErr('')
    try { await api.completeStep(issue.id, step); onRefetch() }
    catch (e) { setErr(errMsg(e, 'Không đánh dấu công đoạn được')) }
    finally { setBusy(false) }
  }

  // StepBatchPanel tự bắt lỗi ném ra từ đây để hiện ngay tại bảng, không dùng `err` chung (đó là
  // lỗi của "Xong {bước}").
  const doRecordStepBatch = async (step: ProcessStep, segments: { segmentSpecId: string; qty: number }[]) => {
    await api.recordStepBatch(issue.id, { step, segments })
    onRefetch()
  }

  const catEditable = issue.status === 'RECEIVED' || (issue.status === 'QC_PASSED' && outstanding > 0)
  const catPanel = (
    <CutBatchPanel
      issue={issue} readOnly={catEditable ? readOnly : true}
      progress={progressByMaterial.get(issue.materialId) ?? null} review={review}
      onRefetch={onRefetch} onOpenCuttingGuide={onOpenCuttingGuide}
    />
  )
  const nonCatSteps = issue.status !== 'RECEIVED' ? issue.requiredSteps.filter(s => s !== 'CAT') : []
  const items = [
    { key: 'CAT', label: 'Cắt', done: !catEditable, panel: catPanel },
    ...nonCatSteps.map(step => ({
      key: step,
      label: PROCESS_STEP_LABELS[step],
      done: issue.completedSteps.includes(step),
      panel: (
        <StepBatchPanel
          step={step} readOnly={readOnly || issue.completedSteps.includes(step)} progress={getStepProgressItem(issue.materialId, step)}
          busy={busy} onRecord={segments => doRecordStepBatch(step, segments)}
          onFinish={() => doCompleteStep(step)}
        />
      ),
    })),
  ]
  const visibleItems = items.filter(i => subFilter === 'all' || i.key === subFilter)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {issue.materialName}
            {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: RED }}><RotateCcw size={11} /> KCS trả về</span>}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {issue.status === 'ISSUED' || issue.status === 'RECEIVED' ? issue.barCount : baoCat} cây × {issue.barLengthMm.toLocaleString('vi-VN')}mm
            {issue.status === 'RECEIVED' && <span style={{ color: ACCENT, fontWeight: 600, marginLeft: 8 }}>đang cắt</span>}
            {issue.status === 'AWAITING_QC' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AMBER, fontWeight: 700, marginLeft: 8 }}><Clock size={11} /> chờ KCS</span>}
            {issue.status === 'QC_PASSED' && outstanding > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: RED, fontWeight: 700, marginLeft: 8 }}>
                Lỗi {outstanding} đoạn{awaitingRecheck && <span style={{ color: AMBER }}>· chờ KCS duyệt lại</span>}
              </span>
            )}
            {issue.status === 'QC_PASSED' && outstanding === 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GREEN, fontWeight: 700, marginLeft: 8 }}><Check size={11} /> đã phôi</span>
            )}
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <button onClick={() => setSubFilter('all')} style={subFilterBtn(subFilter === 'all')}>Tất cả</button>
          {items.map(item => (
            <button key={item.key} onClick={() => setSubFilter(item.key)} style={subFilterBtn(subFilter === item.key)}>
              {item.done && <Check size={12} style={{ marginRight: 4, verticalAlign: -1 }} />}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visibleItems.map((item, idx) => (
          <div key={item.key} style={idx > 0 ? { borderTop: '1px solid var(--border)', paddingTop: 14 } : undefined}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5, color: item.done ? GREEN : PURPLE }}>
              {item.done ? <Check size={13} /> : <Wrench size={13} />} {item.label}{item.done && ' — đã xong'}
            </div>
            {item.panel}
          </div>
        ))}
        {visibleItems.length === 0 && (
          <div style={{ ...card, padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Không có mục nào</div>
        )}
      </div>

      {err && <div style={{ marginTop: 12, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}

// ── Bảng Cần / Đã cắt / Lỗi / Còn lại + form nhập đợt cắt + lịch sử ──────
// RECEIVED (cắt lần đầu): đầy đủ form nhập đợt cắt + "Báo cắt xong". QC_PASSED còn lỗi (2026-08-24,
// vòng 2 - CHỈ 2 kết quả Đạt/Không đạt): chế độ XEM + nút "Bù đủ" mỗi cỡ đoạn - Phôi tự bù bằng sắt
// kiếm ngoài thực tế (KHÔNG đụng cây sắt kho đã cấp, KHÔNG qua recordCutBatch), CHỜ KCS duyệt lại
// mới hết lỗi (QcReviewsService.reportSegmentDone/recheck) - ẩn hẳn ô nhập đợt cắt/"Báo cắt xong"
// ở chế độ này.
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
            {busy ? '...' : 'Báo cắt xong'}
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

// ── Bảng Cần / Đã {bước} / Còn lại + form nhập số lượng cho 1 công đoạn chi tiết SAU Cắt ────
// (2026-08-27) - mirror CutBatchPanel nhưng không có barCount/mauNguyên/scrap (bước này không tác
// động lên cây sắt, chỉ xử lý tiếp trên các đoạn ĐÃ cắt). `progress` đọc từ getStepProgress
// (StepBatchSegment), khác nguồn CutBundle của CutBatchPanel. Lỗi từ onRecord (vd vượt số đã cắt,
// BE chặn) hiện ngay tại đây - không dùng err[l.id] của PiDetail (đó là lỗi riêng "Xong {bước}").
function StepBatchPanel({ step, readOnly, progress, busy, onRecord, onFinish }: {
  step: ProcessStep; readOnly: boolean; progress: BePhoiProgressItem | null; busy: boolean
  onRecord: (segments: { segmentSpecId: string; qty: number }[]) => Promise<void>
  onFinish: () => void
}) {
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const segments = progress?.segments ?? []
  const doneEnough = segments.length > 0 && segments.every(s => s.done >= s.required)
  const stepLabel = PROCESS_STEP_LABELS[step]

  const submit = async () => {
    const rows = segments
      .map(s => ({ segmentSpecId: s.segmentSpecId, qty: Math.floor(Number(rowInputs[s.segmentSpecId]) || 0) }))
      .filter(r => r.qty > 0)
    if (rows.length === 0) { setErr(`Nhập ít nhất 1 cỡ đoạn đã ${stepLabel.toLowerCase()}`); return }
    setSaving(true); setErr('')
    try { await onRecord(rows); setRowInputs({}) }
    catch (e) { setErr(errMsg(e, 'Không lưu được đợt - kiểm lại số liệu')) }
    finally { setSaving(false) }
  }

  if (!progress) return <LoadingState />

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
        Cần {stepLabel.toLowerCase()} theo định mức lệnh này:
      </div>
      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã {stepLabel.toLowerCase()}</th>
              <th style={thR}>Còn lại</th>
              {!readOnly && <th style={{ ...thR, width: 100 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            {segments.map(s => {
              const remaining = s.required - s.done
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.required}</td>
                  <td style={tdR}>{s.done}</td>
                  <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining > 0 ? remaining : 0}</td>
                  {!readOnly && (
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
              <tr><td colSpan={readOnly ? 4 : 5} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Chưa xác định được định mức cho công đoạn này
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && segments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button onClick={submit} disabled={saving}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Plus size={13} /> {saving ? '...' : 'Lưu đợt'}
          </button>
          <button onClick={onFinish} disabled={busy}
            style={{
              ...smallBtn, cursor: busy ? 'not-allowed' : 'pointer',
              background: doneEnough ? GREEN : 'var(--surface)',
              color: doneEnough ? '#fff' : 'var(--text2)',
              border: doneEnough ? 'none' : '1px solid var(--border)',
            }}>
            {busy ? '...' : `Xong ${stepLabel}`}
          </button>
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}
