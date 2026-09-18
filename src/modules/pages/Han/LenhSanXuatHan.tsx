'use client'

/**
 * Lệnh sản xuất — Công đoạn HÀN (2 tầng: PO → Mảnh).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Piece thật qua production-batches-api.ts
 * khi có `stage`.
 */

import { TwoTierScreen, HAN_CFG } from '../../../components/sanxuat/core'

const CFG = HAN_CFG

export default function LenhSanXuatHan({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={CFG} readOnly={readOnly} stage="HAN" />
}
