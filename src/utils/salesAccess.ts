/**
 * 20/11/2026 (E2E-4): ai được SỬA ở phân hệ Bán hàng (tạo PO, xác nhận cọc, xoá đơn, đổi màu dây / vải nệm).
 * Bám @RequireRole(SALES_STAFF, ADMIN) của BE: Giám đốc chỉ xem. Ẩn nút chỉ để dễ dùng - BE vẫn là nơi quyết định (trả 403).
 * isSale là cột riêng của tài khoản, cũng là cổng vào phân hệ Bán hàng (moduleSelectorAccess.ts).
 */
export interface SalesAccessUser {
  role?: string | null
  isSale?: boolean | null
}

export function canWriteSalesOrders(user: SalesAccessUser | null | undefined): boolean {
  return !!user && (user.role === 'ADMIN' || !!user.isSale)
}
