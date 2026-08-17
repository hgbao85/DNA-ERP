'use client'

/**
 * Lệnh sản xuất — Công đoạn HÀN (2 tầng: PO → Mảnh).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Piece thật qua production-batches-api.ts
 * khi có `stage` — seed dưới đây KHÔNG còn nuôi trang này nữa.
 */

import { TwoTierScreen, HAN_CFG, ISO, minsAgo, type ProcRow } from '../../../components/sanxuat/core'

const CFG = HAN_CFG

// Vẫn export vì KhoPhoiPage (Phôi, còn mock — xem roadmap M3 "Xuất sắt Phôi" hoãn) tính đoạn
// tồn/thừa dựa trên cùng bộ seed này + san-luong.service.ts mock, tách biệt hoàn toàn khỏi trang
// Hàn thật ở dưới. KHÔNG xoá cho tới khi Phôi cũng được nối BE thật.
export function hanSeed(): ProcRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(6), arrangedAt: minsAgo(150),
      // doneQty = 0: "đã hàn" nay derive từ lô báo sản lượng (san-luong.service, stage HAN)
      // → mọi cái đã hàn đều TRỪ ĐOẠN (thực có = KCS-đạt Phôi − tiêu hao). Không hard-code done.
      lines: [
        { id: 111, itemName: 'Ráp khung tựa', spec: 'J55-TUA', needQty: 500, doneQty: 0, perManh: 1, thucCoQty: 0, lastInputAt: minsAgo(35),
          parts: [
            { loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', len: 745, perChiTiet: 2 },
            { loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', len: 1150, perChiTiet: 1 },
            { loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', len: 930, perChiTiet: 1 },
          ] },
        { id: 121, itemName: 'Ráp chân ghế', spec: 'J55-CHAN', needQty: 500, doneQty: 0, perManh: 1, thucCoQty: 140, lastInputAt: minsAgo(80),
          parts: [
            { loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', len: 765, perChiTiet: 2 },
            { loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', len: 745, perChiTiet: 2 },
          ] },
        { id: 131, itemName: 'Hàn giằng ngang', spec: 'J55-GIANG', needQty: 1000, doneQty: 0, perManh: 2, thucCoQty: 300, lastInputAt: minsAgo(20),
          parts: [
            { loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', len: 695, perChiTiet: 2 },
          ] },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(9), arrangedAt: minsAgo(25),
      lines: [
        { id: 211, itemName: 'Ráp khung chính', spec: 'IEA3-KHUNG', needQty: 200, doneQty: 0, perManh: 1, thucCoQty: 80, lastInputAt: null,
          parts: [{ loaiSat: 'Sắt Vuông 6 zem', quyCach: '30×30', len: 900, perChiTiet: 4 }] },
        { id: 221, itemName: 'Hàn chân tròn', spec: 'IEA3-CHAN', needQty: 800, doneQty: 0, perManh: 4, thucCoQty: 0, lastInputAt: null,
          parts: [{ loaiSat: 'Ống sắt tròn', quyCach: 'Φ16', len: 700, perChiTiet: 1 }] },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(4), arrangedAt: null,
      lines: [{ id: 311, itemName: 'Ráp khung mặt bàn', spec: 'TB45-MAT', needQty: 120, doneQty: 0, perManh: 1, thucCoQty: 0, lastInputAt: null,
        parts: [{ loaiSat: 'Sắt Vuông 6 zem', quyCach: '50×50', len: 1100, perChiTiet: 4 }] }],
    },
  ]
}

export default function LenhSanXuatHan({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={CFG} readOnly={readOnly} stage="HAN" />
}
