/**
 * "Gia đình" kho = 1 trong 3 chặng gốc của chuỗi chuyển kho nội bộ (phoi-son-han → vat-tu-tp →
 * thanh-pham). Mỗi gia đình có thể có nhiều kho vật lý: kho gốc (code = đúng tên gia đình) và các
 * kho phụ do Admin tạo thêm dạng '{gia-đình}-{n}' - trước 2026-09-03 chỉ 'thanh-pham' đa-instance
 * (xem isThanhPhamScope() cũ ở MfgWarehousesPage.tsx), nay mở rộng cho cả 3. Mirror đúng
 * D:\DNA-ERP-BE\src\common\utils\warehouse-family.util.ts.
 */
export const WAREHOUSE_FAMILIES = ['phoi-son-han', 'vat-tu-tp', 'thanh-pham'] as const
export type WarehouseFamily = (typeof WAREHOUSE_FAMILIES)[number]

/** Chặng kế tiếp - chỉ để biết gia đình nào hợp lệ tiếp theo, KHÔNG suy ra 1 kho đích cụ thể (từ
 *  2026-09-03 người tạo phiếu tự chọn kho đích cụ thể, xem WarehouseXuatPage.tsx). */
export const FAMILY_ROUTES: Partial<Record<WarehouseFamily, WarehouseFamily>> = {
  'phoi-son-han': 'vat-tu-tp',
  'vat-tu-tp': 'thanh-pham',
}

export function warehouseFamilyOf(code?: string | null): WarehouseFamily | null {
  if (!code) return null
  return WAREHOUSE_FAMILIES.find(f => code === f || code.startsWith(`${f}-`)) ?? null
}

export function isFamilyScope(code: string | null | undefined, family: WarehouseFamily): boolean {
  return warehouseFamilyOf(code) === family
}

/** Alias tương thích ngược - mọi call site cũ dùng isThanhPhamScope() tiếp tục chạy đúng. */
export function isThanhPhamScope(scope?: string | null): boolean {
  return isFamilyScope(scope, 'thanh-pham')
}
