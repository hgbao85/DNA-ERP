'use client'

/**
 * Lệnh sản xuất — Công đoạn PHÔI (3 tầng: PO → Mảnh → Vật tư).
 * Nhận sắt là tự động (kho gửi = nhận) — xem "Lịch sử nhận sắt" trên sidebar.
 * Màn này: bấm thẳng vào PO → mảnh → loại sắt, xác nhận cắt xong theo từng đợt.
 */

import { useState } from 'react'
import { PhoiScreen, PHOI_CFG, type ProcRow } from '../../../components/sanxuat/core'
import { getPhoiRows, setPhoiRows } from '../../../services/api'

const CFG = PHOI_CFG

export default function LenhSanXuatPhoi({ readOnly = false }: { readOnly?: boolean }) {
  // rows đọc từ phoi-lenh-sx.service (persist localStorage) để mỗi lần vào màn này đều
  // thấy cả PO mà KHSX vừa "Bắt đầu sản xuất" sync sang (InspectionContext.startProduction),
  // và mọi thay đổi (bắt đầu/kết thúc ca, xác nhận cắt...) được ghi lại qua đó luôn.
  const [rows, setRowsState] = useState<ProcRow[]>(() => getPhoiRows())
  const setRows: React.Dispatch<React.SetStateAction<ProcRow[]>> = (update) => {
    setRowsState(prev => {
      const next = typeof update === 'function' ? (update as (p: ProcRow[]) => ProcRow[])(prev) : update
      setPhoiRows(next)
      return next
    })
  }
  return <PhoiScreen cfg={CFG} rows={rows} setRows={setRows} readOnly={readOnly} />
}
