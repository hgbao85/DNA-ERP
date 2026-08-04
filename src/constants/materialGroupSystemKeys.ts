/**
 * 6 khoá kỹ thuật cố định seed sẵn cho MaterialGroup.systemKey - dùng để resolve id nhóm
 * vật tư hệ thống (Sắt/Dây/Đinh/Sơn/Phụ kiện/Bao bì) khi lọc MaterialPicker ở 4 trang Spec.
 *
 * QUAN TRỌNG: phải khớp 1-1 với BE
 * (D:\DNA-ERP-BE\src\common\constants\material-group-system-keys.constant.ts) - 2 repo tách
 * rời, không import chung được, sửa 1 bên phải sửa bên kia theo.
 *
 * Nhóm do admin tự tạo thêm ở Admin > Nhóm vật tư có systemKey = null, không khớp giá trị
 * nào ở đây - vô hình với logic Spec (đúng ý, không phải bug).
 */
export const MATERIAL_GROUP_SYSTEM_KEYS = {
  STEEL_BAR: 'STEEL_BAR',
  WIRE: 'WIRE',
  NAIL: 'NAIL',
  PAINT: 'PAINT',
  ACCESSORY: 'ACCESSORY',
  PACKAGING: 'PACKAGING',
} as const

export type MaterialGroupSystemKey =
  (typeof MATERIAL_GROUP_SYSTEM_KEYS)[keyof typeof MATERIAL_GROUP_SYSTEM_KEYS]
