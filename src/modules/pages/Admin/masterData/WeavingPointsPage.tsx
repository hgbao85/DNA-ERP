'use client'
import { Scissors } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getWeavingPoints, createWeavingPoint, updateWeavingPoint, deleteWeavingPoint } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

// BE (module weaving-points) không có field `name` (tên điểm đan) riêng biệt với `code`, cũng
// không có `sortOrder` — 2 field này chỉ tồn tại ở mock cũ nên đã bỏ khỏi cột/form thay vì gửi
// dữ liệu giả. `code` giờ là định danh chính hiển thị (khớp cách Manufacturing/WeavingPointsPage
// đang dùng `code` làm "Tên điểm đan").
interface WeavingPoint {
  id: number
  code: string
  fullName?: string
  aliasNote?: string
  phone?: string
  address?: string
  isActive: boolean
}

export default function WeavingPointsPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<WeavingPoint> = {
    title: 'Điểm đan',
    icon: <Scissors size={18} color="#3949ab" />,
    searchFields: ['code', 'fullName'],
    searchPlaceholder: 'Tìm theo mã, tên đầy đủ...',
    emptyMessage: 'Chưa có điểm đan nào',
    addLabel: 'Thêm điểm đan',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã / Tên điểm đan' },
      { key: 'fullName', label: 'Tên đầy đủ' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'address', label: 'Địa chỉ' },
      {
        key: 'isActive', label: 'Trạng thái', align: 'center', render: (w) => (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: w.isActive ? 'var(--green-bg)' : 'var(--red-bg)',
            color: w.isActive ? 'var(--green)' : 'var(--red)',
          }}>
            {w.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
          </span>
        ),
      },
    ],
    filters: [
      { key: 'active', label: 'Đang hoạt động', predicate: (w) => w.isActive },
      { key: 'inactive', label: 'Ngừng hoạt động', predicate: (w) => !w.isActive },
    ],
    formFields: [
      { name: 'code', label: 'Mã / Tên điểm đan', type: 'text', required: true },
      { name: 'fullName', label: 'Tên đầy đủ', type: 'text' },
      { name: 'phone', label: 'Điện thoại', type: 'text' },
      { name: 'address', label: 'Địa chỉ', type: 'text' },
      { name: 'isActive', label: 'Trạng thái', type: 'checkbox', placeholder: 'Đang hoạt động', defaultValue: true },
    ],
    deleteConfirm: (w) => ({
      title: 'Xóa điểm đan',
      message: `Xóa điểm đan "${w.code}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, w) => {
      if (action === 'create') logAction('weaving-point', String(w.id), 'masterdata.created', w.code)
      else if (action === 'update') logAction('weaving-point', String(w.id), 'masterdata.updated', w.code)
      else logAction('weaving-point', String(w.id), 'masterdata.deleted', w.code)
    },
    api: {
      list: () => getWeavingPoints() as Promise<WeavingPoint[]>,
      create: (data) => createWeavingPoint(data) as Promise<WeavingPoint>,
      update: (id, data) => updateWeavingPoint(id, data) as Promise<WeavingPoint | undefined>,
      remove: (id) => deleteWeavingPoint(id),
    },
  }

  return <AdminEntityPage config={config} />
}
