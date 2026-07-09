'use client'

/**
 * Lệnh sản xuất — Công đoạn PHÔI (3 tầng: PO → Mảnh → Vật tư).
 * Nhận sắt là tự động (kho gửi = nhận) — xem "Lịch sử nhận sắt" trên sidebar.
 * Màn này: bấm thẳng vào PO → mảnh → loại sắt, xác nhận cắt xong theo từng đợt.
 */

import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { PhoiScreen, ISO, minsAgo, type ProcRow, type StageCfg } from '../../../components/lenh-san-xuat/core'

const CFG: StageCfg = { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench }

function seed(): ProcRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(5), arrangedAt: minsAgo(190),
      manhs: [
        {
          id: 11, tenManh: 'Mảnh Tựa', perSku: 1, lines: [
            { id: 111, itemName: 'Sắt Vuông 6 zem', spec: '18×18', needQty: 1000, doneQty: 180, perManh: 2, lastInputAt: minsAgo(95) },
            { id: 112, itemName: 'Sắt Hộp 8 zem', spec: '20×40', needQty: 500, doneQty: 95, perManh: 1, lastInputAt: minsAgo(50) },
            { id: 113, itemName: 'Sắt Hộp 6 zem', spec: '25×50', needQty: 500, doneQty: 90, perManh: 1, lastInputAt: minsAgo(30) },
          ],
        },
        {
          id: 12, tenManh: 'Mảnh Tay', perSku: 2, lines: [
            { id: 121, itemName: 'Sắt Hộp 6 zem', spec: '25×50', needQty: 2000, doneQty: 400, perManh: 2, lastInputAt: minsAgo(40) },
            { id: 122, itemName: 'Sắt Vuông 6 zem', spec: '18×18', needQty: 1000, doneQty: 200, perManh: 1, lastInputAt: minsAgo(20) },
          ],
        },
        {
          id: 13, tenManh: 'Mảnh Mê', perSku: 1, lines: [
            { id: 131, itemName: 'Sắt Hộp 8 zem', spec: '20×40', needQty: 500, doneQty: 20, perManh: 1, lastInputAt: minsAgo(25) },
            { id: 132, itemName: 'Sắt dẹt', spec: '20×3', needQty: 500, doneQty: 0, perManh: 1, lastInputAt: null },
          ],
        },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(8), arrangedAt: minsAgo(30),
      manhs: [
        { id: 21, tenManh: 'Mảnh Khung', lines: [{ id: 211, itemName: 'Sắt Vuông 6 zem', spec: '30×30', needQty: 80, doneQty: 0, lastInputAt: null }] },
        { id: 22, tenManh: 'Mảnh Chân', lines: [{ id: 221, itemName: 'Ống sắt tròn', spec: 'Φ16', needQty: 40, doneQty: 0, lastInputAt: null }] },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(3), arrangedAt: null,
      manhs: [
        { id: 31, tenManh: 'Mảnh Mặt bàn', lines: [{ id: 311, itemName: 'Sắt Vuông 6 zem', spec: '50×50', needQty: 60, doneQty: 0, lastInputAt: null }] },
      ],
    },
  ]
}

export default function LenhSanXuatPhoi({ readOnly = false }: { readOnly?: boolean }) {
  // rows giữ ở đây để tiến độ bền khi rời/quay lại màn (PhoiScreen là controlled)
  const [rows, setRows] = useState<ProcRow[]>(seed)
  return <PhoiScreen cfg={CFG} rows={rows} setRows={setRows} readOnly={readOnly} />
}
