import { useFetch } from './useFetch'
import * as api from '../services/api'
import { MATERIAL_GROUP_SYSTEM_KEYS } from '../constants/materialGroupSystemKeys'

/**
 * Resolve id của 6 nhóm vật tư hệ thống (Sắt/Dây/Đinh/Tán rút/Nút nhựa/Vật tư khác) theo
 * `systemKey` - dùng chung cho các trang Spec để lọc MaterialPicker. Sơn/Phụ kiện/Bao bì
 * (trang Định mức chi tiết) đều dùng chung `other` - phân biệt ở tầng BE, không phải qua
 * nhóm vật tư. `undefined` nghĩa là nhóm chưa được seed (deploy hỏng/chưa chạy "npm run
 * seed" ở BE) - MaterialPicker tự hiện rỗng kèm cảnh báo trong trường hợp này, KHÔNG
 * fallback hiện tất cả (xem MaterialPicker.tsx).
 */
export function useMaterialGroupIds() {
  const { data: groups } = useFetch(() => api.getMaterialGroups(), [])
  const bySystemKey = (key: string) => (groups ?? []).find(g => g.systemKey === key)?.id

  return {
    steel: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.STEEL_BAR),
    wire: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.WIRE),
    nail: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.NAIL),
    rivet: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.RIVET),
    plasticButton: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.PLASTIC_BUTTON),
    other: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.OTHER),
    // "Sắt tự tính" (vd thanh nhôm → chân nhôm, PieceMaterialYield ở BE) - nhóm hệ thống thứ 7,
    // seed/adopt qua prisma/seed.ts (2026-09-30) - trước đó là nhóm admin tự tạo, tra tạm theo
    // codePrefix (dễ vỡ nếu admin đổi prefix qua UI). Giờ resolve qua systemKey ổn định như 6
    // nhóm còn lại.
    satTuTinh: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.SAT_TU_TINH),
  }
}
