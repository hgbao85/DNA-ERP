import { useFetch } from '../hooks/useFetch'
import * as api from '../services/api'
import SearchableSelect from './SearchableSelect'

export interface PickedMaterial {
  id: number
  code: string
  name: string
  unit: string
}

/**
 * Picker vật tư dùng chung cho các trang Spec (Sắt/Dây/Đinh/Sơn/Phụ kiện/Bao bì, xem Việc 2) —
 * chọn từ catalog Material thật (Admin > Vật tư), lọc theo `kind` (bắt buộc đúng loại mới nhập
 * được quota — vd Sắt chỉ chọn được vật tư kind=STEEL_BAR) và tuỳ chọn `materialGroupId` (dùng
 * để tách Dây/Đinh — 2 nhóm cùng kind=CONSUMABLE, xem plan-forms.service.ts bên BE). KHÔNG cho
 * tạo vật tư mới tại đây — vật tư phải được khai báo sẵn ở Admin > Vật tư (đúng kind/nhóm)
 * trước khi hiện lên trong ô chọn này.
 */
export default function MaterialPicker({
  value, onSelect, kind, materialGroupId, placeholder = 'Chọn vật tư…',
}: {
  value: PickedMaterial | null
  onSelect: (m: PickedMaterial | null) => void
  kind: string
  materialGroupId?: number
  placeholder?: string
}) {
  const { data } = useFetch(() => api.getMaterials(), [])
  const options = (data ?? []).filter(
    (m) => m.kind === kind && (materialGroupId == null || m.materialGroupId === materialGroupId),
  )

  return (
    <SearchableSelect
      displayValue={value ? `${value.code} — ${value.name}` : ''}
      options={options}
      getKey={(m) => String(m.id)}
      getSearchText={(m) => `${m.code} ${m.name}`}
      renderOption={(m) => (
        <span>
          <strong>{m.code}</strong> <span style={{ color: 'var(--text3)' }}>— {m.name} ({m.unit})</span>
        </span>
      )}
      onSelect={(m) => onSelect({ id: m.id, code: m.code, name: m.name, unit: m.unit })}
      placeholder={placeholder}
      emptyText="Không tìm thấy — cần thêm vật tư đúng loại ở Admin > Vật tư trước"
    />
  )
}
