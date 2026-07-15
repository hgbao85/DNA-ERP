'use client'

/** Màn hình KCS — Công đoạn SƠN. Đọc/ghi san-luong.service (stage SON) qua KcsStagePage. */

import { SprayCan } from 'lucide-react'
import type { StageCfg } from '../../../components/sanxuat/core'
import KcsStagePage from './KcsStagePage'

const CFG: StageCfg = { label: 'Sơn', done: 'Đã sơn', verb: 'sơn', itemLabel: 'Loại sơn', unit: 'lít', Icon: SprayCan }

export default function KcsSonPage() {
  return <KcsStagePage cfg={CFG} stage="SON" />
}
