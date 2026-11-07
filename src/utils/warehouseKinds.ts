/**
 * Đợt 7 - chia 9 kho (bản v8 12.4). Loại kho + xưởng của các kho cố định (BE migration 20261107090000 tạo đúng các mã này).
 * Kho Phôi/Hàn có riêng từng xưởng; Sơn (gộp Dây - gỗ), Phụ kiện, Thành phẩm dùng chung. Mã giữ tiền tố 'phoi-son-han-' nên
 * các kiểm tra theo nhóm kho cũ (warehouseFamily.ts) vẫn nhận ra.
 */
import { warehouseFamilyOf } from './warehouseFamily'

export type WarehouseKind = 'PHOI' | 'HAN' | 'SON' | 'PHU_KIEN' | 'THANH_PHAM'
export type WorkshopKey = 'PHU_AN' | 'PHUOC_AN'

export const FIXED_WAREHOUSES: Record<string, { name: string; kind: WarehouseKind; workshop: WorkshopKey | null }> = {
  'phoi-son-han': { name: 'Kho Phôi Phú An', kind: 'PHOI', workshop: 'PHU_AN' },
  'phoi-son-han-han-pa': { name: 'Kho Hàn Phú An', kind: 'HAN', workshop: 'PHU_AN' },
  'phoi-son-han-son-pa': { name: 'Kho Sơn Phú An', kind: 'SON', workshop: 'PHU_AN' },
  'phoi-son-han-phoi-pha': { name: 'Kho Phôi Phước An', kind: 'PHOI', workshop: 'PHUOC_AN' },
  'phoi-son-han-han-pha': { name: 'Kho Hàn Phước An', kind: 'HAN', workshop: 'PHUOC_AN' },
  'vat-tu-tp': { name: 'Kho Phụ kiện', kind: 'PHU_KIEN', workshop: null },
}

/** Loại kho theo mã: kho cố định ở trên, kho phụ Admin tạo thêm theo nhóm (vat-tu-tp-* = Phụ kiện, thanh-pham-* = Thành phẩm).
 *  Kho phụ 'phoi-son-han-<số>' cũ không rõ loại -> null. */
export function warehouseKindOf(code: string | null | undefined): WarehouseKind | null {
  if (!code) return null
  const fixed = FIXED_WAREHOUSES[code]
  if (fixed) return fixed.kind
  const family = warehouseFamilyOf(code)
  if (family === 'vat-tu-tp') return 'PHU_KIEN'
  if (family === 'thanh-pham') return 'THANH_PHAM'
  return null
}

/** Tên kho cố định (khi chỉ có mã trong tay); null nếu không phải kho cố định. */
export function fixedWarehouseName(code: string | null | undefined): string | null {
  return code ? (FIXED_WAREHOUSES[code]?.name ?? null) : null
}

/** Phôi/Hàn có kho riêng từng xưởng - vật tư cùng loại được lấy ở kho của xưởng mình. */
export function isWorkshopBoundKind(kind: WarehouseKind | null): boolean {
  return kind === 'PHOI' || kind === 'HAN'
}

/**
 * Danh mục vật tư "thường trực" của 1 kho: vật tư có kho mặc định CÙNG LOẠI (kho Phôi Phước An thấy cả sắt khai kho mặc định
 * Phôi Phú An - BE tự đổi sang kho của xưởng làm lệnh). Kho khác nhóm Phôi-Hàn-Sơn giữ quy tắc cũ: cùng nhóm kho.
 */
export function inWarehouseCatalog(warehouseCode: string, materialWarehouseCode: string | null | undefined): boolean {
  const family = warehouseFamilyOf(warehouseCode)
  if (!family) return false
  const kind = warehouseKindOf(warehouseCode)
  if (family === 'phoi-son-han' && kind) return warehouseKindOf(materialWarehouseCode) === kind
  return warehouseFamilyOf(materialWarehouseCode) === family
}
