'use client'

/** Màn hình KCS — "Vật tư thành phẩm" (needsHan=false, vd chân nhôm). Đọc/ghi production-batches/
 *  qc-reviews thật (stage PHOI) qua KcsStagePage — cùng hạ tầng Hàn/Sơn, thêm 21/08/2026. */

import { Wrench } from 'lucide-react'
import type { StageCfg } from '../../../components/sanxuat/core'
import KcsStagePage from './KcsStagePage'

const CFG: StageCfg = { label: 'Vật tư TP', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Mảnh', unit: 'cái', Icon: Wrench }

export default function KcsVatTuThanhPhamPage() {
  return <KcsStagePage cfg={CFG} stage="PHOI" />
}
