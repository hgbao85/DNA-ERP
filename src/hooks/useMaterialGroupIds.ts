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
    // "Vật tư thành phẩm" (vd thanh nhôm → chân nhôm, PieceMaterialYield ở BE) - nhóm do admin
    // tự tạo (systemKey=null, "vô hình với logic Spec" theo đúng thiết kế MaterialGroup ở BE),
    // nên KHÔNG resolve được qua bySystemKey như 6 nhóm hệ thống trên. Tra theo codePrefix cố
    // định 'VTTP' thay thế - đổi tên/prefix nhóm này ở Admin > Vật tư sẽ làm picker này hiện
    // rỗng, chấp nhận được vì đây là nhóm đơn lẻ do 1 nghiệp vụ cụ thể tạo ra, không phải nhóm
    // hệ thống seed sẵn.
    vatTuTP: (groups ?? []).find(g => g.codePrefix === 'VTTP')?.id,
  }
}
