/**
 * Fixture mock cho "cần kiểm"/"chờ thực thi" theo mảnh - dùng riêng cho dashboard tổng hợp KHSX
 * (ThongKePagePlan.tsx), KHÔNG dùng cho trang Chuyền kiểm thật của thủ kho thành phẩm nữa (trang
 * đó đã nối API thật từ 2026-08-11, xem services/transfer-check-api.ts). Tách riêng ra đây để
 * KhoChuyenKiemPage.tsx không còn lẫn code mock - dashboard KHSX vẫn cần 1 nguồn "cần làm" tổng
 * hợp cho nhiều SKU cùng lúc mà chưa có endpoint tổng hợp thật, nên giữ mock ở đây cho tới khi
 * xây (không thuộc phạm vi quyết định chốt stage TRANSFER_CHECK ngày 2026-08-11).
 */
import type { Sku } from '../../types/sku'

export interface MockPiece {
  id: string
  name: string
  totalQty: number
  choThucThi: number
}

const MANH_PARTS = ['Thân trên', 'Thân dưới', 'Hông', 'Đế', 'Nắp', 'Khung']

function strHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

export function mockTotalQty(pf: Sku): number {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  return 50 + (strHash(code) % 100)
}

export function mockPieces(pf: Sku): MockPiece[] {
  const code = pf.mfgProduct?.factoryCode ?? `#${pf.id}`
  const h = strHash(code)
  const count = 3 + (h % 3)
  const pfTotal = mockTotalQty(pf)
  return Array.from({ length: count }, (_, i) => {
    const totalQty = Math.floor(pfTotal / count) + (i === 0 ? pfTotal % count : 0)
    const choThucThi = Math.min(Math.floor(totalQty * ((h + i * 13) % 4 + 1) / 12), totalQty)
    return {
      id: `${pf.id}-m-${i}`,
      name: MANH_PARTS[(h + i) % MANH_PARTS.length],
      totalQty,
      choThucThi,
    }
  })
}
