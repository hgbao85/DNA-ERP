/**
 * 6 khoá kỹ thuật cố định seed sẵn cho MaterialGroup.systemKey - dùng để resolve id nhóm
 * vật tư hệ thống (Sắt/Dây/Đinh/Tán rút/Nút nhựa - đều nhập chung trong 1 mảnh) khi lọc
 * MaterialPicker ở trang Spec. Sơn/Phụ kiện/Bao bì đều dùng chung nhóm OTHER ("Vật tư
 * khác") - phân biệt qua ConsumableBom.stage / BomAccessoryItem.kind ở BE, không phải qua
 * nhóm vật tư nữa.
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
  RIVET: 'RIVET',
  PLASTIC_BUTTON: 'PLASTIC_BUTTON',
  OTHER: 'OTHER',
} as const

export type MaterialGroupSystemKey =
  (typeof MATERIAL_GROUP_SYSTEM_KEYS)[keyof typeof MATERIAL_GROUP_SYSTEM_KEYS]
