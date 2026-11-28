/** Logic thuần của màn quét QR (chuỗi, trạng thái nút, sắp xếp, gom nhóm). Không đụng React. */
import type {
  BeMyOutputRow, BeScanContext, BeScanMaterial, BeScanOrder, BeScanPieceItem, BeScanSegment, BeStagePi, BeWorkstationBrief, MyOutputState,
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

/** Một lệnh để công nhân chọn báo. `missingPieces` chỉ có ở Hàn / Sơn (stagePis). */
export interface PickablePi { productionInvoiceId: string; code: string; missingPieces?: number; deadline?: string | null }

/**
 * Lệnh công nhân chọn được (23/11/2026, bỏ hàng đợi): Hàn / Sơn = `stagePis` (BE đã sắp hạn giao tăng dần);
 * Phôi = lệnh trong bảng chia (`allocationPis`, bỏ trùng).
 */
export function pickablePis(ctx: BeScanContext): PickablePi[] {
  if ((ctx.stagePis ?? []).length > 0) return ctx.stagePis ?? []
  const seen = new Set<string>()
  return (ctx.allocationPis ?? []).filter((a) => !seen.has(a.productionInvoiceId) && seen.add(a.productionInvoiceId))
}

/**
 * SKU báo được ở màn quét: đang chạy (ACTIVE), hoặc SKU đã huỷ mà QLSX cho cắt tiếp (cutContinued - floorStage FINISHED nhưng
 * vẫn báo được trong phần sắt đã xuất; nghiệp vụ báo 28/11: trước đây màn hiện nhầm "quản lý chưa cho làm").
 */
export function orderReportable(o: Pick<BeScanOrder, 'floorStage' | 'cutContinued'>): boolean {
  return o.floorStage === 'ACTIVE' || !!o.cutContinued
}

/** SKU chọn sẵn: SKU đang chọn nếu còn trong lệnh; không thì SKU đang chạy đầu tiên, rồi SKU cắt tiếp, rồi SKU đầu. */
export function defaultScanOrder<T extends Pick<BeScanOrder, 'productionOrderId' | 'floorStage' | 'cutContinued'>>(
  orders: T[], selectedId: string | null,
): T | null {
  return orders.find((o) => o.productionOrderId === selectedId)
    ?? orders.find((o) => o.floorStage === 'ACTIVE')
    ?? orders.find((o) => o.cutContinued)
    ?? orders[0] ?? null
}

/** Có lệnh nào để chọn báo không. */
export function hasPickablePi(ctx: BeScanContext): boolean {
  return pickablePis(ctx).length > 0
}

/** Hàn / Sơn chỉ có đúng 1 lệnh làm được: chọn sẵn, bỏ hàng chọn lệnh. null = 0 hoặc ≥ 2 lệnh (hoặc tổ Phôi). */
export function soleStagePi(ctx: BeScanContext | null): BeStagePi | null {
  const list = ctx?.stagePis ?? []
  return list.length === 1 ? list[0] : null
}

/** Chữ ngắn trên chip lệnh Hàn / Sơn: "còn thiếu 12 mảnh". */
export function missingPiecesText(n: number): string {
  return `còn thiếu ${fmtQty(Math.max(0, n))} mảnh`
}

/** Tổ không có lệnh nào làm được (spec 5.1; Hàn / Sơn có câu riêng, Phôi theo bảng chia). */
export function noPiText(stage: BeWorkstationBrief['stage']): string {
  if (stage === 'HAN') return 'Tổ Hàn chưa có lệnh nào làm được: chưa có mảnh Phôi đạt KCS, hoặc quản lý chưa cho làm sản phẩm.'
  if (stage === 'SON') return 'Tổ Sơn chưa có lệnh nào làm được: chưa có khung Hàn đạt KCS, hoặc quản lý chưa cho làm sản phẩm.'
  return 'Tổ Phôi chưa có lệnh nào để làm: máy chưa được chia việc, hoặc quản lý chưa cho làm sản phẩm.'
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

export type RowBadgeTone = 'pick' | 'done' | 'bundle'
export interface RowBadge { tone: RowBadgeTone; text: string }

/** Nhãn đầu dòng: Đang báo / Xong / Cắt theo bó (23/11/2026: bỏ nhãn "Đang chạy" của hàng đợi). */
export function rowBadges(o: { picked: boolean; done: boolean; isBundle: boolean }): RowBadge[] {
  const out: RowBadge[] = []
  if (o.picked) out.push({ tone: 'pick', text: 'Đang báo' })
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
  // Giao nhận giữa tổ: vượt số hàng đã nhận (mà chưa vượt kế hoạch) thì nói rõ phải qua kho lấy thêm.
  const received = receivedOverText(p, n)
  return {
    label: p.pieceName,
    value: `${n} mảnh`,
    block: n > max ? (received ?? `Chỉ còn báo được ${max} mảnh (cần ${p.plannedQty}). Sửa lại số.`) : undefined,
  }
}

// ─── giao nhận giữa tổ (Hàn / Sơn) ───────────────────────────────────────────

/** Còn báo được theo kế hoạch (bỏ qua hàng đã nhận) - dòng "Kế hoạch: còn báo được N". */
export function piecePlanLeft(p: Pick<BeScanPieceItem, 'plannedQty' | 'passedQty' | 'awaitingQcQty' | 'openQty'>): number {
  return Math.max(0, p.plannedQty - p.passedQty - p.awaitingQcQty - p.openQty)
}

export interface HandoverTiles { received: number; used: number; left: number; planLeft: number }

/** 3 ô "Đã nhận / Đã làm / Còn" + số còn theo kế hoạch. null = mảnh không tính theo hàng đã nhận (công tắc tắt). */
export function handoverTiles(p: BeScanPieceItem): HandoverTiles | null {
  const h = p.handover
  if (!h) return null
  return { received: h.receivedQty, used: h.usedQty, left: Math.max(0, h.receivedLeft), planLeft: piecePlanLeft(p) }
}

/**
 * Banner đỏ khi số nhập vượt số mảnh đã nhận còn lại (BE cũng chặn). null = không vượt / không áp dụng. Vượt kế hoạch trước thì
 * để câu "Chỉ còn báo được" cũ (kế hoạch là trần chặt hơn).
 */
export function receivedOverText(p: BeScanPieceItem, n: number): string | null {
  const t = handoverTiles(p)
  if (!t || n <= t.left || t.left >= t.planLeft) return null
  return `Chỉ còn ${fmtQty(t.left)} mảnh đã nhận. Qua kho ký phiếu lấy thêm, hoặc báo QLSX.`
}

/** "5 đoạn 1200mm, 3 đoạn 800mm" - nội dung dòng "Đã lưu ..." sau khi báo. */
export function segmentSummary(lines: SegmentLine[]): string {
  return lines.map((x) => `${x.n} đoạn ${fmtMm(x.s.cutLengthMm)}mm`).join(', ')
}
