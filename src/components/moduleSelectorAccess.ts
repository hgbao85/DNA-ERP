// Luật truy cập thẻ phân hệ ở trang chọn phân hệ (ModuleSelector) - tách ra hàm thuần để test (19/11/2026).
// Quyền các thẻ cũ giữ NGUYÊN như khi viết inline; chỉ thêm thẻ 'boss' (Giám đốc, không mfgRole).

/** Phần của user mà luật truy cập cần đọc. */
export interface ModuleAccessUser {
  role?: string | null
  mfgRole?: string | null
  isSale?: boolean | null
  isPurchaser?: boolean | null
  isProductPlanner?: boolean | null
}

/** Các phân hệ đã làm xong (thẻ khác hiện "SẮP RA MẮT"). */
export const IMPLEMENTED_MODULE_IDS = ['boss', 'sales', 'production', 'purchasing', 'inbound_warehouse', 'production_plan'] as const

export function isModuleImplemented(moduleId: string): boolean {
  return (IMPLEMENTED_MODULE_IDS as readonly string[]).includes(moduleId)
}

/** User có được bấm vào thẻ phân hệ này không. Thẻ chưa làm luôn false. */
export function isModuleAccessible(moduleId: string, user: ModuleAccessUser | null | undefined): boolean {
  if (!isModuleImplemented(moduleId)) return false
  const isBoss = user?.role === 'BOSS'
  switch (moduleId) {
    // Trùng isDirector(): BOSS không mfgRole.
    case 'boss':            return isBoss && !user?.mfgRole
    case 'sales':           return (isBoss && !user?.mfgRole) || !!user?.isSale
    case 'production':      return isBoss || !!user?.mfgRole
    case 'purchasing':      return (isBoss && !user?.mfgRole) || !!user?.isPurchaser
    case 'inbound_warehouse':
      if (user?.mfgRole || user?.isProductPlanner || user?.isPurchaser || user?.isSale) return false
      return user?.role === 'WAREHOUSE_STAFF' || isBoss
    case 'production_plan': return (isBoss && !user?.mfgRole) || !!user?.isProductPlanner
    default:                return false
  }
}
