'use client'
import { Truck } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface Supplier {
  id: number
  name: string
  phone?: string | null
  isActive: boolean
}

export default function SuppliersPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<Supplier> = {
    title: 'Nhà cung cấp',
    icon: <Truck size={18} color="#3949ab" />,
    searchFields: ['name', 'phone'],
    searchPlaceholder: 'Tìm theo tên hoặc SĐT...',
    emptyMessage: 'Chưa có nhà cung cấp nào',
    addLabel: 'Thêm nhà cung cấp',
    pageSize: 10,
    columns: [
      { key: 'name', label: 'Tên nhà cung cấp' },
      { key: 'phone', label: 'Điện thoại' },
      {
        key: 'isActive', label: 'Trạng thái', align: 'center', render: (s) => (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: s.isActive ? 'var(--green-bg)' : 'var(--red-bg)',
            color: s.isActive ? 'var(--green)' : 'var(--red)',
          }}>
            {s.isActive ? 'Hoạt động' : 'Ngừng hợp tác'}
          </span>
        ),
      },
    ],
    filters: [
      { key: 'active', label: 'Đang hoạt động', predicate: (s) => s.isActive },
      { key: 'inactive', label: 'Ngừng hợp tác', predicate: (s) => !s.isActive },
    ],
    formFields: [
      { name: 'name', label: 'Tên nhà cung cấp', type: 'text', required: true },
      { name: 'phone', label: 'Điện thoại', type: 'text' },
      { name: 'isActive', label: 'Trạng thái', type: 'checkbox', placeholder: 'Đang hoạt động', defaultValue: true },
    ],
    deleteConfirm: (s) => ({
      title: 'Xóa nhà cung cấp',
      message: `Xóa nhà cung cấp "${s.name}"? Các liên kết vật tư — nhà cung cấp hiện có sẽ không còn hiển thị NCC này. Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, s) => {
      if (action === 'create') logAction('supplier', String(s.id), 'masterdata.created', s.name)
      else if (action === 'update') logAction('supplier', String(s.id), 'masterdata.updated', s.name)
      else logAction('supplier', String(s.id), 'masterdata.deleted', s.name)
    },
    api: {
      list: getSuppliers as () => Promise<Supplier[]>,
      create: (data) => createSupplier(data) as unknown as Promise<Supplier>,
      update: (id, data) => updateSupplier(id, data) as Promise<Supplier | undefined>,
      remove: (id) => deleteSupplier(id),
    },
  }

  return <AdminEntityPage config={config} />
}
