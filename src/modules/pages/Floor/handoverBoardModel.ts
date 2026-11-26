/**
 * Logic thuần của tab "Giao nhận giữa tổ" (QLSX, màn Sản lượng xưởng - 24/11/2026, docs THIET-KE-GIAO-NHAN-GIUA-TO 3.3b / 3.4):
 * bảng theo lệnh + chặng, trạng thái chặn, mở chặn có lý do (kiểm số trước khi gửi BE). Không đụng React.
 */
import type {
  BoardStagePiece, BoardSteel, HandoverBoardPi, HandoverOverride, OverrideStage,
} from '../../../services/stage-handover-api'

export const HANDOVER_TAB_LABEL = 'Giao nhận giữa tổ'
/** Câu nhắc trong hộp mở chặn (owner duyệt). */
export const OVERRIDE_NOTE = 'Chỉ mở chặn hàng đã nhận, không vượt kế hoạch. Hệ thống ghi nhật ký và báo Sếp.'
/** Trang của link thông báo STAGE_HANDOVER_OVERRIDE (BE notification-types: page 'giao-nhan-giua-to'). */
export const HANDOVER_URL_PAGE = 'giao-nhan-giua-to'

export const OVERRIDE_STAGE_LABEL: Record<OverrideStage, string> = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn' }

const fmt = (n: number) => n.toLocaleString('vi-VN')

// ─── bảng tóm tắt ────────────────────────────────────────────────────────────

export type BoardStatus = { blocked: boolean; text: string }

export interface BoardSummaryRow {
  key: string
  pi: HandoverBoardPi
  /** Dòng đầu của lệnh (gộp ô Lệnh). */
  first: boolean
  chang: string
  /** null = không áp dụng ở chặng này (hiện "—"). */
  awaitingQty: number | null
  handedNotUsedQty: number | null
  status: BoardStatus
}

/**
 * 2 dòng mỗi lệnh: "Phôi → Hàn / Sơn" (đoạn đạt KCS còn ở kho Phôi chờ giao; chặn khi đoạn đã báo vượt 102% sắt đã nhận) và
 * "Hàn / Sơn" (đoạn / mảnh đã giao chưa làm; chặn khi còn kế hoạch mà hết hàng đã nhận).
 */
export function boardSummaryRows(pis: readonly HandoverBoardPi[]): BoardSummaryRow[] {
  return pis.flatMap((pi) => [
    {
      key: `${pi.productionInvoiceId}:PHOI`, pi, first: true, chang: 'Phôi → Hàn / Sơn',
      awaitingQty: pi.awaitingHandoverQty, handedNotUsedQty: null,
      status: pi.steelBlocked
        ? { blocked: true, text: 'đang bị chặn · sắt vượt 102%' }
        : { blocked: false, text: 'bình thường' },
    },
    {
      key: `${pi.productionInvoiceId}:HAN_SON`, pi, first: false, chang: 'Hàn / Sơn',
      awaitingQty: null, handedNotUsedQty: pi.handedNotUsedQty,
      status: pi.blockedPieceCount > 0
        ? { blocked: true, text: `đang bị chặn · ${fmt(pi.blockedPieceCount)} mảnh` }
        : { blocked: false, text: 'bình thường' },
    },
  ])
}

/** Lệnh có gì bất thường (để xếp lên đầu). */
export const piHasBlock = (pi: HandoverBoardPi) => pi.steelBlocked || pi.blockedPieceCount > 0

/** Lệnh bị chặn lên trước, giữ thứ tự BE trong từng nhóm. */
export function sortBoardPis(pis: readonly HandoverBoardPi[]): HandoverBoardPi[] {
  return [...pis.filter(piHasBlock), ...pis.filter((p) => !piHasBlock(p))]
}

// ─── chi tiết ────────────────────────────────────────────────────────────────

/** Trạng thái 1 mảnh ở tổ Hàn / Sơn. */
export function pieceStatus(p: Pick<BoardStagePiece, 'blocked' | 'maxNow' | 'receivedLeft'>): BoardStatus {
  if (p.blocked) return { blocked: true, text: 'đang bị chặn' }
  if (p.maxNow <= 0) return { blocked: false, text: 'đã đủ kế hoạch' }
  return { blocked: false, text: 'bình thường' }
}

/** % mm đoạn đã báo / mm sắt đã nhận dùng được (null khi chưa nhận sắt). */
export function steelPercent(s: Pick<BoardSteel, 'usableMm' | 'reportedMm'>): number | null {
  if (!(s.usableMm > 0)) return null
  return Math.round((s.reportedMm / s.usableMm) * 1000) / 10
}

export function steelStatus(s: Pick<BoardSteel, 'blocked' | 'usableMm' | 'reportedMm' | 'receivedBarCount'>): BoardStatus {
  if (s.receivedBarCount <= 0) return { blocked: false, text: 'chưa nhận sắt' }
  if (s.blocked) return { blocked: true, text: 'đang bị chặn' }
  const pct = steelPercent(s)
  if (pct != null && pct > 100) return { blocked: false, text: 'vượt sắt đã nhận (trong 2%)' }
  return { blocked: false, text: 'bình thường' }
}

/**
 * Mở chặn mảnh được tối đa bao nhiêu mà vẫn có ích: số báo được = min(còn kế hoạch, còn theo hàng đã nhận) nên mở quá
 * (còn kế hoạch − còn theo hàng đã nhận) không cho báo thêm được gì (BE cũng không cho vượt kế hoạch).
 */
export function pieceOverrideRoom(p: Pick<BoardStagePiece, 'maxNow' | 'receivedLeft'>): number {
  const left = Math.max(0, p.receivedLeft ?? 0)
  return Math.max(0, Math.floor(p.maxNow - left))
}

/** Có nên hiện nút "Mở chặn" ở dòng mảnh: chỉ dòng tính theo hàng đã nhận và còn chỗ để mở. */
export const canOverridePiece = (p: Pick<BoardStagePiece, 'maxNow' | 'receivedLeft'>) =>
  p.receivedLeft != null && pieceOverrideRoom(p) > 0

/** Mục đang mở chặn trong hộp thoại. */
export type OverrideTarget =
  | { stage: 'HAN' | 'SON'; productionOrderId: string; pieceId: string; label: string; room: number }
  | { stage: 'PHOI'; materialId: string; label: string; room: null }

export const overrideUnit = (t: Pick<OverrideTarget, 'stage'>) => (t.stage === 'PHOI' ? 'mm' : 'mảnh')

export interface OverrideErrors { qty: string | null; reason: string | null }

/** Kiểm ô nhập của hộp mở chặn (cùng điều kiện BE: số > 0, mảnh là số nguyên, lý do ≥ 3 ký tự, ≤ 500). */
export function validateOverride(t: OverrideTarget, qtyRaw: string, reason: string): OverrideErrors {
  const unit = overrideUnit(t)
  const raw = qtyRaw.trim().replace(',', '.')
  const n = Number(raw)
  let qty: string | null = null
  if (!raw) qty = `Nhập số ${unit} cho làm thêm`
  else if (!Number.isFinite(n) || n <= 0) qty = 'Số phải lớn hơn 0'
  else if (t.stage !== 'PHOI' && !Number.isInteger(n)) qty = 'Số mảnh phải là số nguyên'
  else if (t.stage === 'PHOI' && !/^\d+(\.\d{1,4})?$/.test(raw)) qty = 'Tối đa 4 số lẻ'
  else if (t.room != null && n > t.room) {
    qty = t.room > 0
      ? `Không vượt kế hoạch: mở thêm tối đa ${fmt(t.room)} mảnh`
      : 'Mảnh này không còn kế hoạch để mở thêm'
  }
  const r = reason.trim()
  const reasonErr = r.length === 0 ? 'Cần ghi lý do mở chặn' : r.length < 3 ? 'Lý do ít nhất 3 ký tự' : r.length > 500 ? 'Lý do tối đa 500 ký tự' : null
  return { qty, reason: reasonErr }
}

export const overrideValid = (e: OverrideErrors) => !e.qty && !e.reason

export function parseOverrideQty(qtyRaw: string): number {
  return Number(qtyRaw.trim().replace(',', '.'))
}

/** Cột "Mục" của danh sách mở chặn đã cấp. */
export function overrideTargetText(o: Pick<HandoverOverride, 'stage' | 'pieceName' | 'pieceCode' | 'materialCode' | 'pieceId' | 'materialId'>): string {
  if (o.stage === 'PHOI') return `Sắt ${o.materialCode ?? o.materialId ?? ''}`.trim()
  const name = o.pieceName ?? (o.pieceId ? `Mảnh ${o.pieceId}` : 'Mảnh')
  return o.pieceCode ? `${name} (${o.pieceCode})` : name
}

/** Khoá focus của dòng lệnh - link thông báo gửi `focus=PI_CODE:<mã PI>`. */
export const piFocusKey = (code: string) => `PI_CODE:${code}`

/** Mã PI trong `focus` của link thông báo (null nếu không phải dạng PI_CODE:). */
export function piCodeFromFocus(focus: string | null | undefined): string | null {
  if (!focus?.startsWith('PI_CODE:')) return null
  return focus.slice('PI_CODE:'.length) || null
}
