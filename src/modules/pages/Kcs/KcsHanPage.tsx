'use client'

/** Màn hình KCS — Công đoạn HÀN. Đọc/ghi production-batches/qc-reviews thật (stage HAN) qua KcsStagePage. */

import { Flame } from 'lucide-react'
import type { StageCfg } from '../../../components/sanxuat/core'
import KcsStagePage from './KcsStagePage'

const CFG: StageCfg = { label: 'Hàn', done: 'Đã hàn', verb: 'hàn', itemLabel: 'Chi tiết', unit: 'cái', Icon: Flame }

export default function KcsHanPage() {
  return <KcsStagePage cfg={CFG} stage="HAN" />
}
