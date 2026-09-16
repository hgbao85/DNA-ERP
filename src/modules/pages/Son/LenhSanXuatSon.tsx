'use client'

/**
 * Lệnh sản xuất — Công đoạn SƠN (2 tầng: PO → Mảnh).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Piece thật qua production-batches-api.ts
 * khi có `stage` — không còn seed cứng.
 */

import { TwoTierScreen, SON_CFG } from '../../../components/sanxuat/core'

export default function LenhSanXuatSon({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={SON_CFG} readOnly={readOnly} stage="SON" />
}
