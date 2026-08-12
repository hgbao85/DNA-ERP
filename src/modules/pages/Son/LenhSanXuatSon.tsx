'use client'

/**
 * Lệnh sản xuất — Công đoạn SƠN (2 tầng: PO → Mảnh/khung).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Part thật qua production-batches-api.ts
 * khi có `stage` — không còn seed cứng.
 */

import { TwoTierScreen, SON_CFG, type StageCfg } from '../../../components/sanxuat/core'

// Override riêng cho màn Tổ Sơn: đếm mảnh (cái) thay vì loại sơn (lít).
const CFG: StageCfg = { ...SON_CFG, itemLabel: 'Mảnh', unit: 'cái' }

export default function LenhSanXuatSon({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={CFG} readOnly={readOnly} stage="SON" />
}
