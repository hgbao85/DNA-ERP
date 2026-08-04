import { useFetch } from './useFetch'
import * as api from '../services/api'
import { MATERIAL_GROUP_SYSTEM_KEYS } from '../constants/materialGroupSystemKeys'

/**
 * Resolve id của 6 nhóm vật tư hệ thống (Sắt/Dây/Đinh/Sơn/Phụ kiện/Bao bì) theo `systemKey` -
 * dùng chung cho các trang Spec để lọc MaterialPicker. `undefined` nghĩa là nhóm chưa được
 * seed (deploy hỏng/chưa chạy "npm run seed" ở BE) - MaterialPicker tự hiện rỗng kèm cảnh
 * báo trong trường hợp này, KHÔNG fallback hiện tất cả (xem MaterialPicker.tsx).
 */
export function useMaterialGroupIds() {
  const { data: groups } = useFetch(() => api.getMaterialGroups(), [])
  const bySystemKey = (key: string) => (groups ?? []).find(g => g.systemKey === key)?.id

  return {
    steel: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.STEEL_BAR),
    wire: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.WIRE),
    nail: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.NAIL),
    paint: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.PAINT),
    accessory: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.ACCESSORY),
    packaging: bySystemKey(MATERIAL_GROUP_SYSTEM_KEYS.PACKAGING),
  }
}
