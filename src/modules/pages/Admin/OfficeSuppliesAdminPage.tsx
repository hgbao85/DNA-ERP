import { useState } from 'react'
import { Warehouse as WarehouseIcon } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getWarehouses } from '../../../services/api'
import type { BeWarehouse } from '../../../services/warehouses-api'
import OfficeSuppliesPage from '../InboundWarehouse/OfficeSuppliesPage'

// Văn phòng phẩm là RIÊNG THEO TỪNG KHO (xem OfficeSuppliesService.assertWarehouseScope ở BE) -
// khác thủ kho (có sẵn User.warehouseScope để suy ra đúng 1 kho), Admin không gắn kho nào nên
// cần tự chọn kho muốn quản lý trước. Backend đã cho Admin toàn quyền (bypass RBAC hoàn toàn) -
// phần còn thiếu chỉ là lối vào UI, nên trang này chỉ là 1 dropdown chọn kho rồi tái dùng nguyên
// OfficeSuppliesPage.tsx (không viết lại logic CRUD/nhập-xuất/lịch sử).
export default function OfficeSuppliesAdminPage() {
  const { data: warehouses, isLoading } = useFetch<BeWarehouse[]>(getWarehouses)
  const realWarehouses = (warehouses ?? []).filter(w => !w.isVirtual && w.isActive)
  const [selectedCode, setSelectedCode] = useState('')

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Văn phòng phẩm</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text3)' }}>
        Chọn kho để quản lý vật tư văn phòng của đúng kho đó (danh sách/tồn/lịch sử riêng theo từng kho).
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <WarehouseIcon size={15} color="var(--text3)" />
        <select
          value={selectedCode}
          onChange={e => setSelectedCode(e.target.value)}
          disabled={isLoading}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', flex: 1, minWidth: 0, maxWidth: 360 }}
        >
          <option value="">{isLoading ? 'Đang tải danh sách kho...' : '— Chọn kho —'}</option>
          {realWarehouses.map(w => (
            <option key={w.id} value={w.code}>{w.name}</option>
          ))}
        </select>
      </div>

      {selectedCode ? (
        <OfficeSuppliesPage warehouseCode={selectedCode} />
      ) : (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }}>
          Chọn 1 kho ở trên để xem/quản lý vật tư văn phòng của kho đó.
        </div>
      )}
    </div>
  )
}
