/**
 * Logic thuần của phần "sản lượng" trên Hướng dẫn cắt (23/11/2026, gộp Sản lượng vào Hướng dẫn cắt): số Đã cắt / KCS đạt /
 * Lỗi / Còn thiếu theo từng cỡ đoạn từ GET /production-invoices/:id/phoi-progress, dòng nhỏ công đoạn phụ, nhãn "Xong Phôi dd/mm".
 * Không đụng React.
 */
import type { BePhoiProgressItem, BePhoiProgressSegment } from '../../../services/steel-issues-api'
import type { BeStageProgressRow } from '../../../services/floor-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'

/** Số của 1 cỡ đoạn (cùng nghĩa với "Tổng hợp lệnh SX": phoi-progress `done` = đã báo − thiếu, vẫn gồm lỗi). */
export interface SegmentOutput {
  required: number
  /** Đã cắt = done (đã trừ phần KCS ghi thiếu). */
  cut: number
  /** KCS đạt = done − lỗi − chưa chấm (≥ 0); chỉ để hiện riêng, không dùng tính Còn thiếu. */
  passed: number
  failed: number
  /** Đã báo mà KCS chưa chấm xong (đang mở + KCS đang chấm). */
  waiting: number
  /** Trong `waiting`: đã lưu đợt, KCS chưa bấm Chấm. */
  open: number
  /** Trong `waiting`: KCS đã bấm Chấm, chưa chấm xong. */
  awaiting: number
  /** Còn thiếu = max(0, cần − (đã cắt − lỗi)) (chốt 23/11: phần chưa chấm tính tạm; cùng "Tổng hợp lệnh SX" và BE). */
  missing: number
}

type SegmentLike = Pick<BePhoiProgressSegment, 'required' | 'done' | 'failed' | 'openQty' | 'awaitingQcQty'>

export function segmentOutputOf(s: SegmentLike): SegmentOutput {
  const open = Math.max(0, s.openQty ?? 0)
  const awaiting = Math.max(0, s.awaitingQcQty ?? 0)
  const waiting = open + awaiting
  const passed = Math.max(0, s.done - s.failed - waiting)
  return { required: s.required, cut: s.done, passed, failed: s.failed, waiting, open, awaiting, missing: Math.max(0, s.required - Math.max(0, s.done - s.failed)) }
}

/**
 * Cột "SL cần" của bảng cắt: có số phoi-progress thì lấy `required` (đã gồm phần cắt lại), khớp "Còn thiếu"; không có thì giữ
 * số của phương án (`demand`, NaN = chưa biết -> null). `recut` = phần cắt lại hơn số phương án (để ghi nhỏ "+n cắt lại").
 */
export function needShown(demand: number, o: Pick<SegmentOutput, 'required'> | undefined): { value: number | null; recut: number } {
  const base = Number.isNaN(demand) ? null : demand
  if (!o) return { value: base, recut: 0 }
  return { value: o.required, recut: base != null && o.required > base ? o.required - base : 0 }
}

export const outputKey = (materialId: string, cutLengthMm: number) => `${materialId}:${cutLengthMm}`

/** Số Cắt theo (loại sắt, cỡ đoạn). */
export function cutOutputsOf(items: BePhoiProgressItem[] | null | undefined): Map<string, SegmentOutput> {
  const out = new Map<string, SegmentOutput>()
  for (const it of items ?? []) for (const s of it.segments) out.set(outputKey(it.materialId, s.cutLengthMm), segmentOutputOf(s))
  return out
}

/** 1 công đoạn phụ của 1 cỡ đoạn: nhãn + số KCS đạt / cần. */
export interface StepLine { step: string; label: string; passed: number; required: number }

/** Công đoạn phụ (Uốn, Dập...) theo (loại sắt, cỡ đoạn); chỉ cỡ có công đoạn phụ mới có khoá. */
export function stepLinesOf(items: BePhoiProgressItem[] | null | undefined): Map<string, StepLine[]> {
  const out = new Map<string, StepLine[]>()
  for (const it of items ?? []) {
    for (const st of it.steps ?? []) {
      for (const s of st.segments) {
        if (s.required <= 0) continue
        const key = outputKey(it.materialId, s.cutLengthMm)
        const list = out.get(key) ?? []
        list.push({ step: st.step, label: PROCESS_STEP_LABELS[st.step] ?? st.step, passed: segmentOutputOf(s).passed, required: s.required })
        out.set(key, list)
      }
    }
  }
  return out
}

/** "Uốn 6/20 · Dập 0/20". Rỗng nếu cỡ không có công đoạn phụ. */
export function stepLinesText(lines: StepLine[] | undefined): string {
  return (lines ?? []).map((l) => `${l.label} ${l.passed.toLocaleString('vi-VN')}/${l.required.toLocaleString('vi-VN')}`).join(' · ')
}

/** Chữ nhỏ dưới số Đã cắt, cùng bộ chữ màn quản lý: "2 đang mở · 5 KCS đang chấm"; không có thì rỗng. */
export function waitingText(open: number, awaiting: number): string {
  const n = (v: number) => v.toLocaleString('vi-VN')
  return [open > 0 ? `${n(open)} đang mở` : '', awaiting > 0 ? `${n(awaiting)} KCS đang chấm` : ''].filter(Boolean).join(' · ')
}

/** "Xong Phôi 23/11" theo giờ Việt Nam; null / sai định dạng thì null. */
export function phoiDoneLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const text = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  return `Xong Phôi ${text}`
}

/** Chia danh sách id thành lô tối đa `size` (BE nhận tối đa 200 id mỗi lần). */
export function chunkIds(ids: string[], size = 200): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/** Tiến độ Phôi của từng lệnh theo id lệnh. */
export function progressById(rows: BeStageProgressRow[] | null | undefined): Map<string, BeStageProgressRow> {
  return new Map((rows ?? []).map((r) => [r.productionInvoiceId, r]))
}

/** Dòng tóm tắt đầu trang chi tiết lệnh: "Mảnh Phôi: còn thiếu N · xem ↓" / "Mảnh Phôi: đủ"; không có mảnh nào thì null. */
export function piecesSummaryText(pieces: { remaining: number }[]): string | null {
  if (pieces.length === 0) return null
  const missing = pieces.reduce((a, p) => a + Math.max(0, p.remaining), 0)
  return missing > 0 ? `Mảnh Phôi: còn thiếu ${missing.toLocaleString('vi-VN')} · xem ↓` : 'Mảnh Phôi: đủ'
}

/** Tiến độ Phôi của từng lệnh theo mã lệnh (ghép với danh sách lệnh của màn). */
export function progressByCode(rows: BeStageProgressRow[] | null | undefined): Map<string, BeStageProgressRow> {
  return new Map((rows ?? []).map((r) => [r.code, r]))
}
