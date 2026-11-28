/**
 * Kiểm kê mảnh ở kho Sơn (28/11/2026 - nghiệp vụ 27/11: Sơn chỉ đếm mảnh, không đếm thanh phôi). Thủ kho nhập SỐ ĐẾM; FE tính
 * phần chênh và gửi 1 bút toán chỉnh tồn đối ứng kho ảo "Cân đối tồn kho" (OPENING_BALANCE), kèm tồn lúc mở hộp để BE so - lệch
 * thì 409, tải lại rồi nhập lại.
 */

export interface DongManh {
  pieceId: string
  pieceCode: string
  pieceName: string
  qty: number
}

/** Dòng tồn mảnh của 1 kho, sắp theo mã mảnh. Gộp nếu cùng mảnh có nhiều dòng (BE khoá cả ô kho + mảnh). */
export function dongTonManh(
  quants: { warehouseId: string; pieceId?: string | null; pieceCode?: string | null; pieceName?: string | null; qty: number }[] | null | undefined,
  warehouseId: string | null,
): DongManh[] {
  if (!warehouseId) return []
  const m = new Map<string, DongManh>()
  for (const q of quants ?? []) {
    if (q.warehouseId !== warehouseId || !q.pieceId) continue
    const cu = m.get(q.pieceId)
    if (cu) cu.qty = Math.round((cu.qty + q.qty) * 1e4) / 1e4
    else m.set(q.pieceId, { pieceId: q.pieceId, pieceCode: q.pieceCode ?? q.pieceId, pieceName: q.pieceName ?? '', qty: q.qty })
  }
  return [...m.values()].sort((a, b) => a.pieceCode.localeCompare(b.pieceCode, 'vi', { numeric: true }))
}

/** Số đếm hợp lệ: số nguyên ≥ 0 (mảnh đếm theo cái). Trả null nếu không hợp lệ. */
export function docSoDem(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

/** Bút toán chỉnh tồn cho 1 lần kiểm kê; null khi số đếm trùng tồn (không ghi gì). */
export function butToanKiemKe(p: {
  warehouseId: string
  openingBalanceWarehouseId: string
  pieceId: string
  tonHeThong: number
  soDem: number
  ghiChu: string
}): {
  fromWarehouseId: string
  toWarehouseId: string
  pieceId: string
  qty: number
  note: string
  expectedWarehouseId: string
  expectedCurrentQty: number
} | null {
  const chenh = Math.round((p.soDem - p.tonHeThong) * 1e4) / 1e4
  if (chenh === 0) return null
  return {
    fromWarehouseId: chenh > 0 ? p.openingBalanceWarehouseId : p.warehouseId,
    toWarehouseId: chenh > 0 ? p.warehouseId : p.openingBalanceWarehouseId,
    pieceId: p.pieceId,
    qty: Math.abs(chenh),
    note: `Kiểm kê mảnh: ${p.tonHeThong} → ${p.soDem}. ${p.ghiChu.trim()}`,
    expectedWarehouseId: p.warehouseId,
    expectedCurrentQty: p.tonHeThong,
  }
}
