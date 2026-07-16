'use client'
import { Scissors } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getWeavingPoints, createWeavingPoint, updateWeavingPoint, deleteWeavingPoint } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface WeavingPoint {
  id: number
  code: string
  name: string
  fullName?: string
  phone?: string
  isActive: boolean
  sortOrder?: number
}

export default function WeavingPointsPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<WeavingPoint> = {
    title: 'Điểm đan',
    icon: <Scissors size={18} color="#3949ab" />,
    searchFields: ['code', 'name', 'fullName'],
    searchPlaceholder: 'Tìm theo mã, tên điểm đan...',
    emptyMessage: 'Chưa có điểm đan nào',
    addLabel: 'Thêm điểm đan',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Tên điểm đan' },
      { key: 'fullName', label: 'Người phụ trách' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'sortOrder', label: 'Thứ tự', align: 'right' },
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
      { name: 'code', label: 'Mã điểm đan', type: 'text', required: true },
      { name: 'name', label: 'Tên điểm đan', type: 'text', required: true },
      { name: 'fullName', label: 'Người phụ trách', type: 'text' },
      { name: 'phone', label: 'Điện thoại', type: 'text' },
      { name: 'sortOrder', label: 'Thứ tự hiển thị', type: 'number' },
      { name: 'isActive', label: 'Trạng thái', type: 'checkbox', placeholder: 'Đang hoạt động', defaultValue: true },
    ],
    deleteConfirm: (w) => ({
      title: 'Xóa điểm đan',
      message: `Xóa điểm đan "${w.name}" (${w.code})? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, w) => {
      const label = `${w.code} — ${w.name}`
      if (action === 'create') logAction('weaving-point', String(w.id), 'masterdata.created', label)
      else if (action === 'update') logAction('weaving-point', String(w.id), 'masterdata.updated', label)
      else logAction('weaving-point', String(w.id), 'masterdata.deleted', label)
    },
    api: {
      list: () => getWeavingPoints() as Promise<WeavingPoint[]>,
      create: (data) => createWeavingPoint(data) as Promise<WeavingPoint>,
      update: (id, data) => updateWeavingPoint(Number(id), data) as Promise<WeavingPoint | undefined>,
      remove: (id) => deleteWeavingPoint(Number(id)),
    },
  }

  return <AdminEntityPage config={config} />
}
