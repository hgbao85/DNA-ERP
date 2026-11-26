/**
 * Logic thuần của Chuyền kiểm / Đóng gói bằng quét QR (24/11/2026, docs THIET-KE-CHUYEN-KIEM-DONG-GOI-QR C1-C4, D1-D4) - tách khỏi
 * giao diện để kiểm thử. Trần ở đây chỉ để khoá nút sớm; BE (ck-dg-caps.util.ts) luôn kiểm lại dưới khoá.
 */

import type { CkBatch, DgReport } from '../../../../services/ck-dg-api'

/** Tài khoản PIN thuộc 3 tổ mới - màn /floor rẽ sang màn chuyền kiểm / đóng gói / KCS chuyền kiểm. */
export const CK_DG_ROLES = ['CHUYEN_KIEM', 'DONG_GOI', 'KCS_CHUYEN_KIEM'] as const
export type CkDgRole = (typeof CK_DG_ROLES)[number]
export const isCkDgRole = (r: string | null | undefined): r is CkDgRole =>
  !!r && (CK_DG_ROLES as readonly string[]).includes(r)

export const CK_DG_ROLE_LABEL: Record<CkDgRole, string> = {
  CHUYEN_KIEM: 'Chuyền kiểm', DONG_GOI: 'Đóng gói', KCS_CHUYEN_KIEM: 'KCS chuyền kiểm',
}

/** Kết quả kiểm 1 form: `reason` = vì sao chưa lưu được (hiện trên nút tắt). */
export interface FormCheck { ok: boolean; reason: string | null }
const ok: FormCheck = { ok: true, reason: null }
const no = (reason: string): FormCheck => ({ ok: false, reason })

/** Số nguyên không âm từ ô nhập (rỗng = 0). */
export const toQty = (s: string): number => {
  const n = Number(s.replace(/\D/g, '').slice(0, 6) || 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * C1 + C3: công nhân chuyền kiểm báo đạt / lỗi cho 1 mảnh. Lỗi > 0 thì bắt buộc nguyên nhân + ít nhất 1 ảnh; đạt + lỗi không vượt
 * "còn kiểm được" (Hiện có − đã kiểm − chờ KCS − đã bỏ).
 */
export function ckReportCheck(o: {
  pieceChosen: boolean
  passed: number
  defect: number
  reasonId: string | null
  photoCount: number
  available: number
  busy?: boolean
}): FormCheck {
  if (o.busy) return no('Đang lưu…')
  if (!o.pieceChosen) return no('Chọn mảnh trước')
  if (o.passed + o.defect <= 0) return no('Nhập số đạt hoặc số lỗi')
  if (o.passed + o.defect > o.available) {
    return no(o.available <= 0 ? 'Mảnh này chưa còn hàng để kiểm' : `Đạt + lỗi vượt số còn kiểm được (${o.available})`)
  }
  if (o.defect > 0 && !o.reasonId) return no('Có lỗi thì chọn nguyên nhân')
  if (o.defect > 0 && o.photoCount < 1) return no('Có lỗi thì chụp ít nhất 1 ảnh')
  return ok
}

/** D1 + D2: công nhân đóng gói báo số bộ - không vượt số còn đóng được (bộ đã qua KCS chuyền kiểm, số lượng lệnh). */
export function packingCheck(o: { itemChosen: boolean; qty: number; available: number; busy?: boolean }): FormCheck {
  if (o.busy) return no('Đang lưu…')
  if (!o.itemChosen) return no('Chọn lệnh trước')
  if (o.qty <= 0) return no('Nhập số bộ đã đóng')
  if (o.qty > o.available) {
    return no(o.available <= 0 ? 'Chưa có bộ nào qua KCS chuyền kiểm để đóng' : `Vượt số còn đóng được (${o.available})`)
  }
  return ok
}

/** Số KCS chấm cho 1 đợt. */
export interface KcsGrade { passed: number; rework: number; scrap: number }

/** Mặc định khi KCS mở 1 đợt: tin số công nhân báo (đạt = báo đạt, lỗi báo = làm lại). */
export const kcsDefaults = (b: Pick<CkBatch, 'passedQty' | 'defectQty'>): KcsGrade =>
  ({ passed: b.passedQty, rework: b.defectQty, scrap: 0 })

/** Số báo đạt mà KCS chấm lỗi thêm (cần nguyên nhân). */
export const kcsExtraDefect = (b: Pick<CkBatch, 'passedQty'>, passed: number): number => Math.max(0, b.passedQty - passed)

/** Đổi số đạt: phần lỗi còn lại dồn vào "làm lại", giữ "bỏ" nếu còn vừa. */
export function kcsSetPassed(b: Pick<CkBatch, 'passedQty' | 'defectQty'>, g: KcsGrade, passed: number): KcsGrade {
  const p = Math.min(Math.max(0, passed), b.passedQty)
  const defects = b.passedQty + b.defectQty - p
  const scrap = Math.min(g.scrap, defects)
  return { passed: p, rework: defects - scrap, scrap }
}

/** Đổi số bỏ: phần còn lại của lỗi là làm lại. */
export function kcsSetScrap(b: Pick<CkBatch, 'passedQty' | 'defectQty'>, g: KcsGrade, scrap: number): KcsGrade {
  const defects = b.passedQty + b.defectQty - g.passed
  const s = Math.min(Math.max(0, scrap), defects)
  return { ...g, scrap: s, rework: defects - s }
}

/** C2: cùng quy tắc BE validateKcsGrade + nguyên nhân khi chấm lỗi thêm. */
export function kcsGradeCheck(
  b: Pick<CkBatch, 'passedQty' | 'defectQty'>,
  g: KcsGrade,
  reasonId: string | null,
  busy = false,
): FormCheck {
  if (busy) return no('Đang lưu…')
  if ([g.passed, g.rework, g.scrap].some((n) => !Number.isInteger(n) || n < 0)) return no('Số không hợp lệ')
  if (g.passed > b.passedQty) return no(`Đạt không quá số báo đạt (${b.passedQty})`)
  if (g.passed + g.rework + g.scrap !== b.passedQty + b.defectQty) {
    return no(`Đạt + làm lại + bỏ phải bằng ${b.passedQty + b.defectQty}`)
  }
  if (kcsExtraDefect(b, g.passed) > 0 && !reasonId) return no('Chấm lỗi thêm thì chọn nguyên nhân')
  return ok
}

/** "Báo đạt 8 · lỗi 2 (Trầy sơn)". */
export function batchReportText(b: Pick<CkBatch, 'passedQty' | 'defectQty' | 'defectReason'>): string {
  const defect = b.defectQty > 0 ? ` · lỗi ${b.defectQty}${b.defectReason ? ` (${b.defectReason})` : ''}` : ''
  return `Báo đạt ${b.passedQty}${defect}`
}

/** "KCS: đạt 7 · làm lại 2 · bỏ 1" / "Chờ KCS chuyền kiểm". */
export function batchKcsText(b: Pick<CkBatch, 'kcs'>): string {
  if (!b.kcs) return 'Chờ KCS chuyền kiểm'
  const parts = [`đạt ${b.kcs.passedQty}`]
  if (b.kcs.reworkQty) parts.push(`làm lại ${b.kcs.reworkQty}`)
  if (b.kcs.scrapQty) parts.push(`bỏ ${b.kcs.scrapQty}`)
  return `KCS: ${parts.join(' · ')}`
}

/** Số liệu đầu màn theo dõi chuyền kiểm của kho. */
export function monitorTotals(batches: readonly CkBatch[]) {
  let awaiting = 0, awaitingQty = 0, passed = 0, rework = 0, scrap = 0
  for (const b of batches) {
    if (!b.kcs) { awaiting += 1; awaitingQty += b.passedQty + b.defectQty; continue }
    passed += b.kcs.passedQty; rework += b.kcs.reworkQty; scrap += b.kcs.scrapQty
  }
  return { awaiting, awaitingQty, passed, rework, scrap }
}

/** Số liệu đầu màn đối chiếu đóng gói: đang tính / đã huỷ. */
export function reconcileTotals(reports: readonly DgReport[]) {
  let activeQty = 0, active = 0, cancelled = 0, cancelledQty = 0
  for (const r of reports) {
    if (r.cancelled) { cancelled += 1; cancelledQty += r.qty } else { active += 1; activeQty += r.qty }
  }
  return { active, activeQty, cancelled, cancelledQty }
}

/** Lý do huỷ lần báo đóng gói: bắt buộc, ít nhất 3 ký tự (cùng BE). */
export const cancelReasonOk = (s: string): boolean => s.trim().length >= 3

/** Lần báo gần đây là đợt chuyền kiểm (có pieceId) hay lần đóng gói. */
export const isCkBatch = (r: CkBatch | DgReport): r is CkBatch => 'pieceId' in r

/** Lọc danh sách theo chữ gõ (lệnh / SKU / mảnh / người báo). */
export function matchesQuery(r: { lenhCode: string; sku: string; productName: string; reportedByName: string | null; pieceName?: string }, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [r.lenhCode, r.sku, r.productName, r.reportedByName ?? '', r.pieceName ?? ''].some((x) => x.toLowerCase().includes(s))
}
