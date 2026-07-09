'use client'

/** Lệnh sản xuất — Công đoạn SƠN (2 tầng: PO → Vật tư/loại sơn). */

import { SprayCan } from 'lucide-react'
import { TwoTierScreen, ISO, minsAgo, type ProcRow, type StageCfg } from '../../../components/lenh-san-xuat/core'

const CFG: StageCfg = { label: 'Sơn', done: 'Đã sơn', verb: 'sơn', itemLabel: 'Loại sơn', unit: 'lít', Icon: SprayCan }

function seed(): ProcRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(7), arrangedAt: minsAgo(140),
      lines: [{ id: 111, itemName: 'Sơn đen tĩnh điện', spec: 'SN-DEN-01', needQty: 120, doneQty: 60, lastInputAt: minsAgo(70) }],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(10), arrangedAt: minsAgo(25),
      lines: [{ id: 211, itemName: 'Sơn xám tĩnh điện', spec: 'SN-XM-001', needQty: 60, doneQty: 0, lastInputAt: null }],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(5), arrangedAt: null,
      lines: [{ id: 311, itemName: 'Sơn đen tĩnh điện', spec: 'SN-DEN-01', needQty: 40, doneQty: 0, lastInputAt: null }],
    },
  ]
}

export default function LenhSanXuatSon({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={CFG} seed={seed} readOnly={readOnly} />
}
