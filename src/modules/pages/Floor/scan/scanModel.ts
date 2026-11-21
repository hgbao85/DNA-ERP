/** Logic thuần của màn quét QR (chuỗi, trạng thái nút, sắp xếp, gom nhóm). Không đụng React. */
import type {
  BeMyOutputRow, BeScanContext, BeScanMaterial, BeScanPieceItem, BeScanSegment, BeWorkstationBrief, MyOutputState,
} from '../../../../services/floor-api'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { dayKey, describeError, STAGE_LABEL, STEP_LABEL, type OutputTotal } from '../floorUi'
import type { ConfirmRow } from './ScanParts'

export { STAGE_LABEL, STEP_LABEL }
export const LAST_WS_KEY = 'floor.lastWs'
export const LAST_USER_KEY = 'floor.lastUsername'
/** Số dòng việc của máy hiện sẵn trên màn quét; còn lại bấm "Xem thêm". */
export const MACHINE_WORK_PREVIEW = 3
/** BE chỉ trả tối đa chừng này lần báo gần nhất (floor-scan.service myOutput: take 500). */
export const MAX_OUTPUT_ROWS = 500
/** Chữ của nút ở dòng đang báo (khối Việc của máy): trạng thái, không lặp lại lời mời "Báo cho lệnh này". */
export const PICKED_ROW_TEXT = 'Đang báo lệnh này · nhập số ở dưới'
/** Giải thích dấu ≈, hiện một lần trong khối Việc của máy. */
export const APPROX_NOTE = '≈ là số ước từ số đoạn đã báo'

export function safeGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
export function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* trình duyệt chặn lưu - bỏ qua */ }
}
export const errText = (e: unknown) => describeError(e).text
export const digits = (s: string) => s.replace(/\D/g, '').slice(0, 5)
export const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 6)
export const fmtMm = (n: number) => n.toLocaleString('vi-VN')
export const fmtQty = (n: number) => n.toLocaleString('vi-VN')

// ─── chọn lệnh ───────────────────────────────────────────────────────────────

/** Lệnh trong bảng chia mà chưa có ở "đang làm" / "làm bù" (khỏi hiện 2 lần). */
export function allocationOnlyPis(ctx: BeScanContext) {
  const seen = new Set<string>([
    ...(ctx.runningPi ? [ctx.runningPi.productionInvoiceId] : []),
    ...(ctx.reworkPis ?? []).map((r) => r.productionInvoiceId),
  ])
  return (ctx.allocationPis ?? []).filter((a) => !seen.has(a.productionInvoiceId) && seen.add(a.productionInvoiceId))
}

/** Có lệnh nào để chọn báo không (đang làm / làm bù / trong bảng chia). */
export function hasPickablePi(ctx: BeScanContext): boolean {
  return !!ctx.runningPi || (ctx.reworkPis ?? []).length > 0 || (ctx.allocationPis ?? []).length > 0
}

/** Tổ chỉ có 1 lệnh (đang chạy, không làm bù, không thêm từ bảng chia): bỏ hàng chọn lệnh. */
export function isOnlyRunningPi(ctx: BeScanContext | null): boolean {
  return !!ctx?.runningPi && (ctx.reworkPis ?? []).length === 0 && allocationOnlyPis(ctx).length === 0
}

/** Đang chọn một lệnh làm bù (không phải lệnh đang chạy). */
export function isReworkSelected(ctx: BeScanContext, selectedPi: string | null): boolean {
  return !!selectedPi && selectedPi !== ctx.runningPi?.productionInvoiceId
    && (ctx.reworkPis ?? []).some((r) => r.productionInvoiceId === selectedPi)
}

/** Tiêu đề màn theo loại máy. */
export function reportTitle(w: Pick<BeWorkstationBrief, 'kind' | 'processStep' | 'stage'>): string {
  if (w.kind === 'STEEL_RECEIVE') return 'Nhận sắt'
  if (w.kind === 'CUT') return 'Báo cắt'
  if (w.kind === 'STEP') return `Báo ${STEP_LABEL[w.processStep ?? ''] ?? 'công đoạn'}`
  return `Báo ${STAGE_LABEL[w.stage]}`
}

/** Dòng phụ dưới tiêu đề: mã máy · loại máy cắt · xưởng · tổ (21/11/2026: mã thay tên - màn QLSX bỏ tên gọi). */
export function workstationSubtitle(w: BeWorkstationBrief): string {
  const type = w.kind === 'CUT' && w.cutMachineType ? ` · ${MACHINE_LABEL[w.cutMachineType]}` : ''
  const shop = w.workshopName ? ` · ${w.workshopName}` : ''
  return `${w.code}${type}${shop} · tổ ${STAGE_LABEL[w.stage]}`
}

// ─── Phôi: số đoạn theo cỡ ───────────────────────────────────────────────────

export type ScanMaterial = BeScanMaterial

/** Chỉ loại sắt có cỡ đoạn thuộc SKU đang chọn (byOrder), cỡ dài xếp trước. PI gộp nhiều SKU thì mỗi SKU 1 bộ cỡ khác nhau. */
export function materialsForSku(materials: BeScanMaterial[], orderId: string): ScanMaterial[] {
  return materials
    .map((m) => ({
      ...m,
      segments: m.segments
        .map((s) => {
          const o = s.byOrder.find((b) => b.productionOrderId === orderId)
          // Số theo SKU: đủ cả lỗi / thiếu / đã báo / maxNow / số thực có (không chỉ required + done) để "còn báo được" đúng SKU.
          return o && o.required > 0
            ? {
              ...s,
              required: o.required, done: o.done, baseRequired: o.baseRequired, extraNeed: o.extraNeed,
              failed: o.failed, shortQty: o.shortQty, reportedQty: o.reportedQty, maxNow: o.maxNow, physicalLeft: o.physicalLeft,
            }
            : null
        })
        .filter((s): s is NonNullable<typeof s> => !!s)
        .sort((a, b) => b.cutLengthMm - a.cutLengthMm),
    }))
    .filter((m) => m.segments.length > 0)
}

/** Báo cắt chỉ làm được với loại sắt ĐÃ nhận; loại chưa nhận gom vào `waiting`. */
export function splitByReceived(forSku: ScanMaterial[], kindLabel: string) {
  const needsReceived = kindLabel === 'Cắt'
  return {
    needsReceived,
    usable: forSku.filter((m) => !needsReceived || m.hasReceivedSteel),
    waiting: forSku.filter((m) => needsReceived && !m.hasReceivedSteel),
  }
}

/**
 * Báo thêm được tối đa bao nhiêu ngay lúc này. Lấy `maxNow` của BE (đã tính cả số cần lẫn số đoạn thực có ở công đoạn trước);
 * BE cũ chưa trả thì tạm dùng số còn cần. Số nhập nhiều hơn số này thì BE chặn 400.
 */
export function segmentMaxNow(s: Pick<BeScanSegment, 'required' | 'done' | 'maxNow'>): number {
  return s.maxNow ?? Math.max(0, s.required - s.done)
}

/**
 * Dòng "còn báo được N" của một cỡ. `left` còn báo được; `none` còn cần nhưng chưa có đoạn ở công đoạn trước (còn báo được 0);
 * `done` đã đủ số cần (`over` = phần vượt, 0 nếu không vượt). Không bao giờ ra số âm.
 */
export function segmentLeft(s: Pick<BeScanSegment, 'required' | 'done' | 'maxNow'>):
  { kind: 'left' | 'none' | 'done'; n: number; over: number } {
  const max = segmentMaxNow(s)
  if (max > 0) return { kind: 'left', n: max, over: 0 }
  if (s.required - s.done > 0) return { kind: 'none', n: 0, over: 0 }
  return { kind: 'done', n: 0, over: Math.max(0, s.done - s.required) }
}

/** Chữ hiện sau "Đã cắt 3/10": "còn báo được 7" / "còn báo được 0" / "đã đủ" / "đã đủ (vượt 2)". */
export function segmentLeftText(s: Pick<BeScanSegment, 'required' | 'done' | 'maxNow'>): string {
  const left = segmentLeft(s)
  if (left.kind === 'done') return left.over > 0 ? `đã đủ (vượt ${left.over})` : 'đã đủ'
  return `còn báo được ${left.n}`
}

/** Số nhập `n` vượt số còn báo được của cỡ (BE sẽ chặn): khoá nút Lưu. */
export function segmentOverMax(s: Pick<BeScanSegment, 'required' | 'done' | 'maxNow'>, n: number): boolean {
  return n > segmentMaxNow(s)
}

/** Báo thêm được tối đa bao nhiêu mảnh (piecePlans[].items[].maxNow); BE cũ chưa trả thì dùng số còn cần. */
export function pieceMaxNow(p: Pick<BeScanPieceItem, 'maxNow' | 'plannedQty' | 'passedQty' | 'awaitingQcQty' | 'openQty'>): number {
  return p.maxNow ?? Math.max(0, p.plannedQty - p.passedQty - p.awaitingQcQty - p.openQty)
}

// ─── nút chính ở cuối màn ────────────────────────────────────────────────────

export interface ScanAction {
  label: string
  disabled: boolean
  /** Lý do ngắn hiện ngay trên nút khi nút tắt. */
  reason: string | null
}

export const NEED_PI_REASON_CUT = 'Chọn lệnh ở Việc của máy trước'
export const NEED_PI_REASON = 'Chọn lệnh ở trên trước'
/** Lý do hiện trên nút Lưu khi số nhập nhiều hơn số còn báo được (BE chặn, không lưu được). */
export const OVER_MAX_REASON = 'Số nhập nhiều hơn số còn báo được'

/** Nút "Lưu N đoạn" của tổ Phôi. */
export function segmentAction(o: { busy: boolean; total: number; blocked: boolean; over?: boolean }): ScanAction {
  if (o.busy) return { label: 'Đang lưu…', disabled: true, reason: null }
  if (o.blocked) return { label: o.total ? `Lưu ${o.total} đoạn` : 'Nhập số đoạn', disabled: true, reason: 'Loại sắt này chưa nhận' }
  if (o.over) return { label: `Lưu ${o.total} đoạn`, disabled: true, reason: OVER_MAX_REASON }
  if (!o.total) return { label: 'Nhập số đoạn', disabled: true, reason: 'Gõ số đoạn vào ô ở trên' }
  return { label: `Lưu ${o.total} đoạn`, disabled: false, reason: null }
}

/** Nút "Lưu N mảnh" của tổ Hàn / Sơn. */
export function pieceAction(o: { busy: boolean; pieceName: string | null; n: number; over?: boolean }): ScanAction {
  if (o.busy) return { label: 'Đang lưu…', disabled: true, reason: null }
  if (!o.pieceName) return { label: 'Nhập số mảnh', disabled: true, reason: 'Chọn mảnh ở trên trước' }
  if (!o.n) return { label: 'Nhập số mảnh', disabled: true, reason: 'Gõ số mảnh vào ô bên trái' }
  if (o.over) return { label: `Lưu ${o.n} ${o.pieceName}`, disabled: true, reason: OVER_MAX_REASON }
  return { label: `Lưu ${o.n} ${o.pieceName}`, disabled: false, reason: null }
}

/** Chưa chọn lệnh nào nên chưa có ô nhập: vẫn hiện nút tắt kèm lý do. */
export function needPiAction(w: Pick<BeWorkstationBrief, 'kind'>, hasMachineWork: boolean): ScanAction {
  return {
    label: w.kind === 'PIECE' ? 'Nhập số mảnh' : 'Nhập số đoạn',
    disabled: true,
    reason: w.kind === 'CUT' && hasMachineWork ? NEED_PI_REASON_CUT : NEED_PI_REASON,
  }
}

// ─── khối Việc của máy ───────────────────────────────────────────────────────

export type RowBadgeTone = 'run' | 'pick' | 'done' | 'bundle'
export interface RowBadge { tone: RowBadgeTone; text: string }

/** Nhãn đầu dòng: Đang chạy / Đang báo / Xong / Cắt theo bó. */
export function rowBadges(o: { running: boolean; picked: boolean; done: boolean; isBundle: boolean }): RowBadge[] {
  const out: RowBadge[] = []
  if (o.running) out.push({ tone: 'run', text: 'Đang chạy' })
  if (o.picked && !o.running) out.push({ tone: 'pick', text: 'Đang báo' })
  if (o.done) out.push({ tone: 'done', text: 'Xong' })
  if (o.isBundle) out.push({ tone: 'bundle', text: 'Cắt theo bó' })
  return out
}

/** Nút "Xem thêm / Thu gọn" chỉ hiện khi có nhiều hơn phần xem trước. */
export function showMoreToggle(total: number, hidden: number, showAll: boolean): boolean {
  return (hidden > 0 || showAll) && total > MACHINE_WORK_PREVIEW
}

// ─── tab Sản lượng của tôi ───────────────────────────────────────────────────

// Chữ cho công nhân (không dùng "KCS"/"QLSX"): "kiểm hàng" = KCS chấm. Từ P1 KCS tự chấm đợt vừa báo, không còn bước
// "quản lý kiểm rồi gửi": đợt đang mở = "Chờ kiểm hàng", KCS đã chốt để chấm = "Đang kiểm hàng".
export const STATE_LABEL: Record<MyOutputState, [string, string, string]> = {
  OPEN: ['Chờ kiểm hàng', 'var(--surface2)', 'var(--text2)'],
  AWAITING_QC: ['Đang kiểm hàng', 'var(--amber-bg)', 'var(--amber)'],
  QC_DONE: ['Đã kiểm xong', 'var(--green-bg)', 'var(--green)'],
  REMOVED: ['—', 'var(--surface2)', 'var(--floor-hint)'],
}

/** "đoạn đã cắt" / "đoạn đã uốn" / "mảnh đã báo" - chú thích dưới con số tổng. Không cộng chung các loại việc (đếm đôi). */
export function opCaption(t: OutputTotal): string {
  if (t.op === 'PIECE') return 'mảnh đã báo'
  return `đoạn đã ${t.op === 'STEP' ? 'làm công đoạn' : (STEP_LABEL[t.op] ?? t.op).toLowerCase()}`
}

/** "Cắt 120 đoạn · Uốn 40 đoạn" - gọn cho dòng đầu mỗi ngày. */
export function totalsText(totals: OutputTotal[]): string {
  return totals.map((t) => t.op === 'PIECE'
    ? `${fmtQty(t.qty)} mảnh`
    : `${t.op === 'STEP' ? 'Công đoạn' : (STEP_LABEL[t.op] ?? t.op)} ${fmtQty(t.qty)} đoạn`).join(' · ')
}

/** pendingText dùng chung với màn QLSX ("đang mở" / "KCS đang chấm") - đổi sang chữ của công nhân. Đổi "KCS đang chấm" trước. */
export function workerPendingText(text: string): string {
  return text.replace(/KCS đang chấm/g, 'đang kiểm hàng').replace(/đang mở/g, 'chờ kiểm hàng')
}

/**
 * Nhãn "KCS: thiếu N · lỗi M" cạnh trạng thái của một lần báo (số của CẢ ĐỢT, không riêng lần này). null = chưa chấm
 * (không hiện); chấm rồi mà không có thiếu / lỗi thì cũng không hiện (đã có nhãn "Đã kiểm xong").
 */
export function kcsLabel(kcs: BeMyOutputRow['kcs']): string | null {
  if (!kcs || (kcs.failedQty <= 0 && kcs.shortQty <= 0)) return null
  return `KCS: thiếu ${fmtQty(kcs.shortQty)} · lỗi ${fmtQty(kcs.failedQty)}`
}

/** Nhãn của số KCS chấm CẢ ĐỢT (ghi rõ "cả đợt" để khỏi hiểu là của riêng lần báo này). */
export function kcsBatchLabel(kcs: BeMyOutputRow['kcs']): string | null {
  const base = kcsLabel(kcs)
  return base ? base.replace(/^KCS:/, 'KCS chấm cả đợt:') : null
}

/**
 * Id các lần báo được hiện nhãn KCS của đợt. API chỉ trả số KCS lặp ở mọi dòng của đợt (không có mã đợt), nên coi các
 * dòng LIỀN NHAU trong danh sách cùng loại việc / lệnh / công đoạn / trạng thái / số KCS là một đợt, và chỉ dòng mới
 * nhất (createdAt lớn nhất) của đợt mang nhãn. Dòng đã hủy không tính.
 */
export function kcsLabelRowIds(rows: BeMyOutputRow[]): Set<string> {
  const ids = new Set<string>()
  // BE mới trả batchKey (mã đợt KCS chấm): chọn dòng mới nhất của từng đợt, kể cả khi các dòng của đợt không liền nhau.
  // BE cũ không có batchKey: đoán theo các dòng liền nhau cùng việc / lệnh / công đoạn / số KCS (cách bên dưới).
  const newestByBatch = new Map<string, BeMyOutputRow>()
  let prevKey: string | null = null
  let best: BeMyOutputRow | null = null
  const flush = () => { if (best) ids.add(best.id); best = null }
  for (const r of rows) {
    if (r.reversed || !kcsLabel(r.kcs)) { flush(); prevKey = null; continue }
    if (r.batchKey) {
      flush(); prevKey = null
      const cur = newestByBatch.get(r.batchKey)
      if (!cur || r.createdAt > cur.createdAt) newestByBatch.set(r.batchKey, r)
      continue
    }
    const k = [r.kind, r.piCode ?? '', r.step ?? '', r.state, r.kcs?.failedQty, r.kcs?.shortQty].join('|')
    if (k !== prevKey) flush()
    prevKey = k
    if (!best || r.createdAt > best.createdAt) best = r
  }
  flush()
  for (const r of newestByBatch.values()) ids.add(r.id)
  return ids
}

/** Gom các lần báo theo ngày, giữ thứ tự xuất hiện. */
export function groupByDay(rows: BeMyOutputRow[]): [string, BeMyOutputRow[]][] {
  const byDay = new Map<string, BeMyOutputRow[]>()
  for (const r of rows) {
    const k = dayKey(r.createdAt)
    byDay.set(k, [...(byDay.get(k) ?? []), r])
  }
  return [...byDay.entries()]
}

/** Tên công việc của một lần báo: " · Cắt" / " · Uốn" / "". */
export function outputKindText(r: Pick<BeMyOutputRow, 'kind' | 'step'>): string {
  if (r.kind === 'CUT') return ' · Cắt'
  return r.step ? ` · ${STEP_LABEL[r.step] ?? r.step}` : ''
}

// ─── bảng xác nhận số đoạn ───────────────────────────────────────────────────

export interface SegmentLine { s: BeScanSegment; n: number }

/** Các cỡ có nhập số > 0 (qty là chuỗi ô nhập theo segmentSpecId). */
export function segmentLines(segments: BeScanSegment[], qty: Record<string, string>): SegmentLine[] {
  return segments.map((s) => ({ s, n: Number(qty[s.segmentSpecId] || 0) })).filter((x) => x.n > 0)
}

/** Có cỡ nào nhập nhiều hơn số còn báo được (BE chặn) thì không cho lưu. */
export function anySegmentOverMax(lines: SegmentLine[]): boolean {
  return lines.some((x) => segmentOverMax(x.s, x.n))
}

/** Dòng của bảng xác nhận; cỡ nào nhập nhiều hơn số còn báo được thì có `block` (dòng đỏ, khoá nút xác nhận). */
export function segmentConfirmRows(lines: SegmentLine[]): ConfirmRow[] {
  return lines.map((x) => {
    const max = segmentMaxNow(x.s)
    return {
      label: `${fmtMm(x.s.cutLengthMm)} mm`,
      value: `${x.n} đoạn`,
      block: x.n > max ? `Chỉ còn báo được ${max} đoạn (cần ${x.s.required}, đã tính ${x.s.done}). Sửa lại số.` : undefined,
    }
  })
}

/** Dòng bảng xác nhận của tổ Hàn / Sơn: nhập nhiều hơn số còn báo được thì có `block`. */
export function pieceConfirmRow(p: BeScanPieceItem, n: number): ConfirmRow {
  const max = pieceMaxNow(p)
  return {
    label: p.pieceName,
    value: `${n} mảnh`,
    block: n > max ? `Chỉ còn báo được ${max} mảnh (cần ${p.plannedQty}). Sửa lại số.` : undefined,
  }
}

/** "5 đoạn 1200mm, 3 đoạn 800mm" - nội dung dòng "Đã lưu ..." sau khi báo. */
export function segmentSummary(lines: SegmentLine[]): string {
  return lines.map((x) => `${x.n} đoạn ${fmtMm(x.s.cutLengthMm)}mm`).join(', ')
}
