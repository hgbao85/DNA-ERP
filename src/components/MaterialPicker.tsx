import { useFetch } from '../hooks/useFetch'
import * as api from '../services/api'
import SearchableSelect from './SearchableSelect'

export interface PickedMaterial {
  id: number
  code: string
  name: string
  unit: string
  spec: string | null
}

/**
 * Picker vật tư dùng chung cho các trang Spec (Sắt/Dây/Đinh/Sơn/Phụ kiện/Bao bì, xem Việc 2) —
 * chọn từ catalog Material thật (Admin > Vật tư), lọc theo `materialGroupId` (id của 1 trong 6
 * nhóm vật tư hệ thống, resolve qua useMaterialGroupIds() — xem skus.service.ts bên BE
 * cho logic gán/kiểm nhóm khi ghi BOM). KHÔNG cho tạo vật tư mới tại đây — vật tư phải được
 * khai báo sẵn ở Admin > Vật tư (đúng Nhóm vật tư) trước khi hiện lên trong ô chọn này.
 *
 * `materialGroupId` là `undefined` khi nhóm hệ thống chưa được seed (deploy hỏng) - hiện
 * rỗng kèm cảnh báo thay vì fallback hiện tất cả vật tư (không còn `kind` để chặn nhầm lẫn
 * giữa các danh mục nữa).
 *
 * `detailKind` lọc thêm khi cần tách Sơn/Phụ kiện/Bao bì — 3 tab đó dùng chung 1
 * `materialGroupId` (nhóm "Vật tư khác") nên phải lọc thêm theo Material.detailKind (gán ở
 * Admin > Vật tư) mới ra đúng danh sách cho từng tab (xem SpecDetailQuotaPage.tsx). Bỏ trống
 * cho các picker khác (Sắt/Dây/Đinh/Tán rút/Nút nhựa) — những nhóm đó không dùng detailKind.
 */
export default function MaterialPicker({
  value, onSelect, materialGroupId, detailKind, placeholder = 'Chọn vật tư…',
}: {
  value: PickedMaterial | null
  onSelect: (m: PickedMaterial | null) => void
  materialGroupId: number | undefined
  detailKind?: 'PAINT' | 'ACCESSORY' | 'PACKAGING'
  placeholder?: string
}) {
  const { data } = useFetch(() => api.getMaterials(), [])
  const options = materialGroupId == null ? [] : (data ?? []).filter((m) =>
    m.materialGroupId === materialGroupId && (detailKind == null || m.detailKind === detailKind)
  )

  return (
    <SearchableSelect
      displayValue={value ? `${value.code} — ${value.name}` : ''}
      options={options}
      getKey={(m) => String(m.id)}
      getSearchText={(m) => `${m.code} ${m.name}`}
      renderOption={(m) => (
        <span>
          <strong>{m.code}</strong> <span style={{ color: 'var(--text3)' }}>— {m.name} ({m.unit}){m.spec ? ` · ${m.spec}` : ''}</span>
        </span>
      )}
      onSelect={(m) => onSelect({ id: m.id, code: m.code, name: m.name, unit: m.unit, spec: m.spec })}
      placeholder={placeholder}
      emptyText={
        materialGroupId == null
          ? 'Chưa cấu hình nhóm vật tư hệ thống — báo Admin kiểm tra Nhóm vật tư / quyền truy cập'
          : detailKind
          ? 'Không tìm thấy — cần thêm vật tư đúng nhóm và Phân loại ở Admin > Vật tư trước'
          : 'Không tìm thấy — cần thêm vật tư đúng nhóm ở Admin > Vật tư trước'
      }
    />
  )
}
