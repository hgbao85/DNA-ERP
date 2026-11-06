'use client'

/**
 * "Phiếu đang lập" (Đợt 6, bản v8 4.4: 1 phiếu nhiều dòng) - thủ kho bấm "Thêm vào phiếu" ở màn xuất sắt / xuất vật tư hàn,
 * sơn; các dòng gom ở đây, sang tab "Phiếu xuất" bấm "Tạo phiếu xuất" để hệ thống cấp số XK. Chỉ giữ trong trình duyệt (chưa
 * gửi BE) - tải lại trang là mất, giống giỏ hàng.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { IssueSlipLineInput } from '../../../services/issue-slips-api'

export interface CartLine extends IssueSlipLineInput {
  /** Khoá gộp: cùng dòng (vật tư + lệnh/SKU + công đoạn + chiều dài) thêm lại thì thay số, không thêm dòng mới. */
  key: string
  materialName: string
  unit: string
  /** Mã lệnh hiển thị (số LSX), SKU (vật tư tiêu hao). */
  lenhLabel: string
}

interface CartCtx {
  lines: CartLine[]
  add: (line: Omit<CartLine, 'key'>) => void
  remove: (key: string) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

const keyOf = (l: Omit<CartLine, 'key'>) =>
  [l.kind, l.materialId, l.productionInvoiceId ?? '', l.productionOrderId ?? '', l.stage ?? '', l.barLengthMm ?? ''].join('|')

export function IssueSlipCartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = keyOf(line)
    setLines(prev => {
      const i = prev.findIndex(l => l.key === key)
      if (i < 0) return [...prev, { ...line, key }]
      const next = [...prev]
      next[i] = { ...line, key }
      return next
    })
  }, [])
  const remove = useCallback((key: string) => setLines(prev => prev.filter(l => l.key !== key)), [])
  const clear = useCallback(() => setLines([]), [])
  const value = useMemo(() => ({ lines, add, remove, clear }), [lines, add, remove, clear])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useIssueSlipCart(): CartCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useIssueSlipCart phải nằm trong IssueSlipCartProvider')
  return ctx
}
