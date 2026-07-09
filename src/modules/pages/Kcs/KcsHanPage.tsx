'use client'

/** Màn hình KCS — Công đoạn HÀN (2 tầng: PO → Vật tư, chỉ xem + duyệt). */

import { Flame } from 'lucide-react'
import { KcsTwoTierScreen, type KcsRow } from '../../../components/lenh-san-xuat/kcsCore'
import { ISO, minsAgo, type StageCfg } from '../../../components/lenh-san-xuat/core'

const CFG: StageCfg = { label: 'Hàn', done: 'Đã hàn', verb: 'hàn', itemLabel: 'Chi tiết', unit: 'cái', Icon: Flame }

function seed(): KcsRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(6), arrangedAt: minsAgo(150),
      lines: [
        { id: 111, itemName: 'Ráp khung tựa', spec: 'J55-TUA', needQty: 500, doneQty: 500, perManh: 1, lastInputAt: minsAgo(35), pendingQty: 30 },
        { id: 121, itemName: 'Ráp chân ghế', spec: 'J55-CHAN', needQty: 500, doneQty: 320, perManh: 1, lastInputAt: minsAgo(80), pendingQty: 0, failedQty: 8 },
        { id: 131, itemName: 'Hàn giằng ngang', spec: 'J55-GIANG', needQty: 1000, doneQty: 250, perManh: 2, lastInputAt: minsAgo(20), pendingQty: 50 },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(9), arrangedAt: minsAgo(25),
      lines: [
        { id: 211, itemName: 'Ráp khung chính', spec: 'IEA3-KHUNG', needQty: 200, doneQty: 0, perManh: 1, lastInputAt: null, pendingQty: 0 },
        { id: 221, itemName: 'Hàn chân tròn', spec: 'IEA3-CHAN', needQty: 800, doneQty: 0, perManh: 4, lastInputAt: null, pendingQty: 0 },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(4), arrangedAt: null,
      lines: [{ id: 311, itemName: 'Ráp khung mặt bàn', spec: 'TB45-MAT', needQty: 120, doneQty: 0, perManh: 1, lastInputAt: null, pendingQty: 0 }],
    },
  ]
}

export default function KcsHanPage() {
  return <KcsTwoTierScreen cfg={CFG} seed={seed} />
}
