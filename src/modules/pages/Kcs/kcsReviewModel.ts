/**
 * Logic thuần của các màn KCS (P1, 18/11/2026) - tách khỏi giao diện để test được (vitest môi trường node).
 *
 * 1) Trạng thái dòng (UF2, AC10-AC12): dòng ĐANG MỞ xám theo `blockedReason` của BE; dòng ĐÃ CHỐT (AWAITING_QC) xám theo
 *    `stoppedPis` của GET /floor/review (MF2). KHÔNG tự suy từ order = null.
 * 2) Hộp chấm: Đã báo / Thực có / Lỗi (Cắt) / Làm lại + Bỏ (công đoạn phụ) / Không đạt (mảnh, pat, chân nhôm) -> số thiếu,
 *    kiểm số liệu (không kẹp im lặng) và dựng body gửi BE.
 */
import type { BeReviewBlockedReason } from '../../../services/floor-api'
import type { QcReviewSegmentInput } from '../../../services/steel-issues-api'

// ── Chữ người dùng thấy (bảng chữ chung hợp đồng v2, mục 16) ─────────────────────────────────────────────────────
export const MSG_LENH_DUNG = 'Lệnh đang tạm dừng / đã kết thúc - chưa chấm được'
export const MSG_CHUA_GAN_SKU = 'Dữ liệu cũ chưa gắn SKU - chưa chấm được, báo IT'
export const MSG_FORBIDDEN = 'Chưa có quyền xem các đợt đang mở - tải lại trang sau ít phút hoặc đăng nhập lại.'
export const MSG_ACTUAL_CLAMPED = 'Dư thật thì công nhân báo thêm (nếu còn số cần)'

// ── 1) Trạng thái dòng ─────────────────────────────────────────────────────────────────────────────────────────
export type KcsRowPhase = 'OPEN' | 'AWAITING_QC'

export interface KcsRowState {
  /** Tô xám. */
  muted: boolean
  /** Khoá nút Chấm. */
  locked: boolean
  /** Câu hiện trên dòng xám; null = dòng bình thường. */
  message: string | null
  /** Có tính vào số "chờ chấm" của màn hay không (dòng xám không tính, khớp số đỏ menu). */
  counted: boolean
}

export interface StoppedPi { productionInvoiceId: string; code: string }

/** Tra PI dừng theo id (KcsPhoiPage: có productionInvoiceId) hoặc theo mã PI (KcsStagePage: lô / pat chỉ có piCode). */
export function isPiStopped(
  stoppedPis: readonly StoppedPi[] | null | undefined,
  pi: { productionInvoiceId?: string | null; code?: string | null },
): boolean {
  if (!stoppedPis || stoppedPis.length === 0) return false
  return stoppedPis.some(
    (s) =>
      (pi.productionInvoiceId != null && pi.productionInvoiceId !== '' && s.productionInvoiceId === pi.productionInvoiceId) ||
      (pi.code != null && pi.code !== '' && s.code === pi.code),
  )
}

export function blockedMessage(reason: BeReviewBlockedReason | null | undefined): string | null {
  if (reason === 'LENH_DUNG') return MSG_LENH_DUNG
  if (reason === 'CHUA_GAN_SKU') return MSG_CHUA_GAN_SKU
  return null
}

/**
 * Chọn trạng thái 1 dòng.
 *  - OPEN: theo `blockedReason` của dòng (BE đã tính). null / thiếu (BE cũ) = chấm được.
 *  - AWAITING_QC: `piStopped` (PI nằm trong stoppedPis) -> xám, khoá. Ngoài ra chấm được.
 * Đợt đã chấm xong (QC_PASSED / QC_DONE) không qua hàm này.
 */
export function pickRowState(input: {
  phase: KcsRowPhase
  blockedReason?: BeReviewBlockedReason | null
  piStopped?: boolean
}): KcsRowState {
  const message =
    input.phase === 'OPEN'
      ? blockedMessage(input.blockedReason)
      : input.piStopped
        ? MSG_LENH_DUNG
        : null
  const blocked = message !== null
  return { muted: blocked, locked: blocked, message, counted: !blocked }
}

// ── 2) Hộp chấm ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 *  'CAT'  : Cắt - ô "Lỗi - cắt lại" (lỗi nào cũng phải cắt lại, không có Bỏ).
 *  'STEP' : công đoạn phụ - ô "Làm lại" + "Bỏ, cắt lại".
 *  'FLAT' : mảnh Hàn / Sơn / Vật tư TP, pat, chân nhôm - ô "Không đạt".
 */
export type ReviewKind = 'CAT' | 'STEP' | 'FLAT'

/** Số nguyên không âm từ ô nhập; rỗng / chữ / âm -> 0. */
export function parseQty(raw: string | number | null | undefined): number {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Ô "Thực có": không cho lớn hơn Đã báo (S2 / AC28). Gõ lớn hơn thì tự về Đã báo và báo `clamped` để hiện câu nhắc.
 * Ô rỗng giữ rỗng (= bằng Đã báo).
 */
export function clampActual(raw: string, reported: number): { value: string; clamped: boolean } {
  if (raw.trim() === '') return { value: '', clamped: false }
  const n = parseQty(raw)
  if (n > reported) return { value: String(reported), clamped: true }
  return { value: String(n), clamped: false }
}

export interface RowInput {
  /** Đã báo (số công nhân báo trong đợt). */
  reported: number
  /** Thực có (chuỗi ô nhập); rỗng = bằng Đã báo. */
  actual: string
  /** CAT / FLAT: ô lỗi (Lỗi - cắt lại / Không đạt). */
  failed?: string
  /** STEP: Làm lại. */
  rework?: string
  /** STEP: Bỏ, cắt lại. */
  scrap?: string
}

export interface RowCalc {
  reported: number
  actual: number
  /** Thiếu = Đã báo - Thực có. */
  short: number
  /** Lỗi (CAT / FLAT: ô lỗi; STEP: làm lại + bỏ). */
  failed: number
  rework: number
  scrap: number
  /** Đạt = Đã báo - thiếu - lỗi. */
  passed: number
  /** Câu báo đỏ của dòng (rỗng = hợp lệ). */
  error: string | null
}

const FAILED_WORD: Record<ReviewKind, string> = { CAT: 'lỗi', STEP: 'lỗi', FLAT: 'không đạt' }

/** Tính 1 dòng chấm + kiểm số liệu. Không kẹp im lặng: số sai thì giữ nguyên và trả `error` (màn báo đỏ + khoá nút). */
export function calcRow(kind: ReviewKind, input: RowInput): RowCalc {
  const reported = Math.max(0, Math.floor(input.reported) || 0)
  const actualRaw = input.actual.trim() === '' ? reported : parseQty(input.actual)
  const actual = Math.min(actualRaw, reported)
  const short = reported - actual
  let rework = 0
  let scrap = 0
  let failed = 0
  if (kind === 'STEP') {
    rework = parseQty(input.rework)
    scrap = parseQty(input.scrap)
    failed = rework + scrap
  } else {
    failed = parseQty(input.failed)
  }
  let error: string | null = null
  if (actualRaw > reported) {
    error = `Thực có không được lớn hơn số đã báo (${reported})`
  } else if (short + failed > reported) {
    // Cùng chữ câu 400 của BE. Đợt cắt / công đoạn: màn tự thêm "Cỡ …mm: " phía trước.
    if (kind === 'FLAT') {
      error = short > 0
        ? `Thiếu (${short}) + ${FAILED_WORD[kind]} (${failed}) vượt số đã báo (${reported})`
        : `Số ${FAILED_WORD[kind]} (${failed}) không được vượt số lượng đã báo (${reported})`
    } else {
      error = `${short > 0 ? `thiếu ${short} + lỗi ${failed}` : `lỗi ${failed}`} vượt số đã báo trong đợt (${reported})`
    }
  }
  return { reported, actual, short, failed, rework, scrap, passed: reported - short - failed, error }
}

/** Tổng SL ở tiêu đề nhóm = số đã báo của MỌI dòng đang chờ; lệnh dừng chỉ làm dòng xám, KHÔNG làm tổng về 0. */
export function sumPendingQty(lines: readonly { pendingQty: number }[]): number {
  return lines.reduce((s, l) => s + l.pendingQty, 0)
}

export interface ReviewTotals {
  reported: number
  passed: number
  failed: number
  rework: number
  scrap: number
  short: number
}

export function sumRows(rows: readonly RowCalc[]): ReviewTotals {
  const t: ReviewTotals = { reported: 0, passed: 0, failed: 0, rework: 0, scrap: 0, short: 0 }
  for (const r of rows) {
    t.reported += r.reported
    t.passed += r.passed
    t.failed += r.failed
    t.rework += r.rework
    t.scrap += r.scrap
    t.short += r.short
  }
  return t
}

export function hasBlockingError(rows: readonly RowCalc[]): boolean {
  return rows.some((r) => r.error !== null)
}

/** Dòng tổng hộp chấm: "Đạt · Lỗi (bỏ a, làm lại b) · Thiếu c" (công đoạn phụ có phần trong ngoặc). */
export function totalsText(kind: ReviewKind, t: ReviewTotals): string {
  const failedWord = kind === 'FLAT' ? 'Không đạt' : 'Lỗi'
  const detail = kind === 'STEP' ? ` (bỏ ${t.scrap}, làm lại ${t.rework})` : ''
  return `Đạt ${t.passed} · ${failedWord} ${t.failed}${detail} · Thiếu ${t.short}`
}

/** Câu báo xong (toast): "120 đạt · 3 lỗi · thiếu 5" - chỉ hiện phần khác 0, luôn có "đạt". */
export function doneText(kind: ReviewKind, t: ReviewTotals): string {
  const parts = [`${t.passed} đạt`]
  if (t.failed > 0) parts.push(`${t.failed} ${kind === 'FLAT' ? 'không đạt' : 'lỗi'}`)
  if (t.short > 0) parts.push(`thiếu ${t.short}`)
  return parts.join(' · ')
}

/** Body `segments` của Cắt / công đoạn phụ. Bỏ dòng lỗi 0 và thiếu 0; scrapQty chỉ gửi với công đoạn phụ (và khi có lỗi). */
export function buildSegmentsPayload(
  kind: 'CAT' | 'STEP',
  rows: readonly { segmentSpecId: string; calc: RowCalc }[],
): QcReviewSegmentInput[] {
  const out: QcReviewSegmentInput[] = []
  for (const { segmentSpecId, calc } of rows) {
    if (calc.failed === 0 && calc.short === 0) continue
    const seg: QcReviewSegmentInput = { segmentSpecId, failedQty: calc.failed }
    if (calc.short > 0) seg.shortQty = calc.short
    if (kind === 'STEP' && calc.failed > 0) seg.scrapQty = calc.scrap
    out.push(seg)
  }
  return out
}

/** Body của mảnh Hàn / Sơn / Vật tư TP, pat, chân nhôm: failedQty = không đạt; shortQty chỉ gửi khi > 0. */
export function buildFlatPayload(calc: RowCalc): { failedQty: number; shortQty?: number } {
  return calc.short > 0 ? { failedQty: calc.failed, shortQty: calc.short } : { failedQty: calc.failed }
}

/** Kết quả ĐÃ chấm của 1 đợt (từ qc_review.segments): lỗi, thiếu, bỏ (cắt lại), làm lại. Dùng cho nhãn "đạt (lỗi …)" ở danh sách. */
export function reviewOutcome(
  segments: readonly { failedQty: number; shortQty?: number; scrapQty?: number }[],
): { failed: number; short: number; scrap: number; rework: number } {
  let failed = 0
  let short = 0
  let scrap = 0
  for (const s of segments) {
    failed += s.failedQty
    short += s.shortQty ?? 0
    scrap += s.scrapQty ?? 0
  }
  return { failed, short, scrap, rework: Math.max(0, failed - scrap) }
}
