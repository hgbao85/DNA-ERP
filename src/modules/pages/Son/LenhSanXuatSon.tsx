'use client'

/** Lệnh sản xuất — Công đoạn SƠN (2 tầng: PO → Mảnh/khung).
 * Tổ Sơn nhận KHUNG HÀN (mảnh) từ Hàn để sơn → đếm theo MẢNH, đơn vị "cái".
 * (Sơn + lít chỉ là vật tư tiêu hao, không đếm tiến độ ở đây — khác màn KHSX dùng SON_CFG gốc theo loại sơn/lít.) */

import { TwoTierScreen, SON_CFG, ISO, minsAgo, type ProcRow, type StageCfg } from '../../../components/sanxuat/core'

// Override riêng cho màn Tổ Sơn: đếm mảnh (cái) thay vì loại sơn (lít).
const CFG: StageCfg = { ...SON_CFG, itemLabel: 'Mảnh', unit: 'cái' }

// Dòng = MẢNH/KHUNG Tổ Hàn đã hàn & KCS đạt, đẩy qua Sơn (đơn vị: cái) — khớp Khung hàn (KhungHanPage).
// spec ghi kèm màu sơn để công nhân biết dùng loại sơn nào (sơn+lít là vật tư tiêu hao, không đếm tiến độ).
function seed(): ProcRow[] {
  return [
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(7), arrangedAt: minsAgo(140),
      lines: [
        { id: 111, itemName: 'Khung tựa', spec: 'J55-TUA · sơn đen', needQty: 500, doneQty: 200, thucCoQty: 300, lastInputAt: minsAgo(70) },
        { id: 121, itemName: 'Chân ghế', spec: 'J55-CHAN · sơn đen', needQty: 500, doneQty: 120, thucCoQty: 180, lastInputAt: minsAgo(95) },
        { id: 131, itemName: 'Giằng ngang', spec: 'J55-GIANG · sơn đen', needQty: 1000, perManh: 2, doneQty: 260, thucCoQty: 20, lastInputAt: minsAgo(40) },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(10), arrangedAt: minsAgo(25),
      lines: [
        { id: 211, itemName: 'Khung chính', spec: 'IEA3-KHUNG · sơn xám', needQty: 200, doneQty: 0, thucCoQty: 80, lastInputAt: null },
        { id: 221, itemName: 'Chân tròn', spec: 'IEA3-CHAN · sơn xám', needQty: 800, perManh: 4, doneQty: 0, thucCoQty: 0, lastInputAt: null },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(5), arrangedAt: null,
      lines: [{ id: 311, itemName: 'Khung mặt bàn', spec: 'TB45-MAT · sơn đen', needQty: 120, doneQty: 0, thucCoQty: 0, lastInputAt: null }],
    },
  ]
}

export default function LenhSanXuatSon({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={CFG} seed={seed} readOnly={readOnly} stage="SON" />
}
