/**
 * Sổ kho - hàm thuần (không React) cho WarehouseLedgerHistory.
 */
import type { BeStockLedgerEntry } from '../services/stock-api'

/** Dòng sửa tay: điều chỉnh / kiểm kê (ADJUST) và tồn đầu kỳ (OPENING_BALANCE). Dòng khác không hiện người. */
export function laDongSuaTay(refType: string): boolean {
  return refType === 'ADJUST' || refType === 'OPENING_BALANCE'
}

/** 'Người sửa: <tên>' cho dòng sửa tay có tên người; còn lại null. */
export function nguoiSuaCuaDong(e: Pick<BeStockLedgerEntry, 'refType' | 'createdByName'>): string | null {
  if (!laDongSuaTay(e.refType)) return null
  const ten = (e.createdByName ?? '').trim()
  return ten ? `Người sửa: ${ten}` : null
}

/**
 * Chữ hiện dưới ô Ghi chú: dòng sửa tay có tên thì 'Người sửa: <tên>'; dòng sửa tay không có tên (tồn đầu kỳ do hệ thống
 * ghi, bút toán cũ) thì 'Người sửa: —'; dòng khác không hiện gì.
 */
export function chuNguoiSuaHienThi(e: Pick<BeStockLedgerEntry, 'refType' | 'createdByName'>): string | null {
  return nguoiSuaCuaDong(e) ?? (laDongSuaTay(e.refType) ? 'Người sửa: —' : null)
}
