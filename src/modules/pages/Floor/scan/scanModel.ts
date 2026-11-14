/** Logic thuần của màn quét QR (chuỗi, trạng thái nút, sắp xếp, gom nhóm). Không đụng React. */
import type {
  BeMyOutputRow, BeScanContext, BeScanMaterial, BeScanSegment, BeWorkstationBrief, MyOutputState,
} from '../../../../services/floor-api'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { dayKey, describeError, overBy, STAGE_LABEL, STEP_LABEL, type OutputTotal } from '../floorUi'

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

/** Dòng phụ dưới tiêu đề: tên máy · loại máy cắt · xưởng · tổ. */
export function workstationSubtitle(w: BeWorkstationBrief): string {
  const type = w.kind === 'CUT' && w.cutMachineType ? ` · ${MACHINE_LABEL[w.cutMachineType]}` : ''
  const shop = w.workshopName ? ` · ${w.workshopName}` : ''
  return `${w.name}${type}${shop} · tổ ${STAGE_LABEL[w.stage]}`
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
          return o && o.required > 0 ? { ...s, required: o.required, done: o.done } : null
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

/** Số còn lại của một cỡ: còn / vượt / đủ. */
export function segmentLeft(s: Pick<BeScanSegment, 'required' | 'done'>): { kind: 'left' | 'over' | 'done'; n: number } {
  const left = s.required - s.done
  if (left > 0) return { kind: 'left', n: left }
  if (left < 0) return { kind: 'over', n: -left }
  return { kind: 'done', n: 0 }
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

/** Nút "Lưu N đoạn" của tổ Phôi. */
export function segmentAction(o: { busy: boolean; total: number; blocked: boolean }): ScanAction {
  if (o.busy) return { label: 'Đang lưu…', disabled: true, reason: null }
  if (o.blocked) return { label: o.total ? `Lưu ${o.total} đoạn` : 'Nhập số đoạn', disabled: true, reason: 'Loại sắt này chưa nhận' }
  if (!o.total) return { label: 'Nhập số đoạn', disabled: true, reason: 'Gõ số đoạn vào ô ở trên' }
  return { label: `Lưu ${o.total} đoạn`, disabled: false, reason: null }
}

/** Nút "Lưu N mảnh" của tổ Hàn / Sơn. */
export function pieceAction(o: { busy: boolean; pieceName: string | null; n: number }): ScanAction {
  if (o.busy) return { label: 'Đang lưu…', disabled: true, reason: null }
  if (!o.pieceName) return { label: 'Nhập số mảnh', disabled: true, reason: 'Chọn mảnh ở trên trước' }
  if (!o.n) return { label: 'Nhập số mảnh', disabled: true, reason: 'Gõ số mảnh vào ô bên trái' }
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

// Chữ cho công nhân (không dùng "KCS"/"QLSX"): "quản lý kiểm" = QLSX kiểm rồi gửi; "kiểm hàng" = KCS chấm.
export const STATE_LABEL: Record<MyOutputState, [string, string, string]> = {
  OPEN: ['Chờ quản lý kiểm', 'var(--surface2)', 'var(--text2)'],
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

/** pendingText dùng chung với màn QLSX ("chưa gửi" / "chờ KCS") - đổi sang chữ của công nhân. */
export function workerPendingText(text: string): string {
  return text.replace(/chưa gửi/g, 'chờ quản lý kiểm').replace(/chờ KCS/g, 'đang kiểm hàng')
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

/** Dòng của bảng xác nhận; cỡ nào báo vượt kế hoạch thì có `warn`. */
export function segmentConfirmRows(lines: SegmentLine[], kindLabel: string) {
  return lines.map((x) => {
    const over = overBy(x.s.required, x.s.done, x.n)
    return {
      label: `${fmtMm(x.s.cutLengthMm)} mm`,
      value: `${x.n} đoạn`,
      warn: over > 0 ? `vượt ${over} so với kế hoạch (cần ${x.s.required}, đã ${kindLabel.toLowerCase()} ${x.s.done})` : undefined,
    }
  })
}

/** "5 đoạn 1200mm, 3 đoạn 800mm" - nội dung dòng "Đã lưu ..." sau khi báo. */
export function segmentSummary(lines: SegmentLine[]): string {
  return lines.map((x) => `${x.n} đoạn ${fmtMm(x.s.cutLengthMm)}mm`).join(', ')
}
