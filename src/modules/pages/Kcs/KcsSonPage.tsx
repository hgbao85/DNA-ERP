'use client'

/** Màn hình KCS — Công đoạn SƠN. Đọc/ghi production-batches/qc-reviews thật (stage SON) qua KcsStagePage. */

import { SprayCan } from 'lucide-react'
import type { StageCfg } from '../../../components/sanxuat/core'
import KcsStagePage from './KcsStagePage'

// itemLabel/unit = 'Mảnh'/'cái' - Sơn báo sản lượng theo MẢNH giống Hàn (ProductionBatch.
// reportedQty), không phải lít sơn tiêu thụ - xem comment SON_CFG ở core.tsx (sửa 2026-09-12).
const CFG: StageCfg = { label: 'Sơn', done: 'Đã sơn', verb: 'sơn', itemLabel: 'Mảnh', unit: 'cái', Icon: SprayCan }

export default function KcsSonPage() {
  return <KcsStagePage cfg={CFG} stage="SON" />
}
