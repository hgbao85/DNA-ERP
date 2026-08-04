'use client'
import { Globe2 } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getMfgExportCustomers, createMfgExportCustomer, updateMfgExportCustomer, deleteMfgExportCustomer } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface ExportCustomer {
  id: number
  name: string
  country?: string | null
  market?: string | null
  contactName?: string | null
}

export default function ExportCustomersPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<ExportCustomer> = {
    title: 'Khách hàng xuất khẩu',
    icon: <Globe2 size={18} color="#3949ab" />,
    searchFields: ['name', 'country', 'market', 'contactName'],
    searchPlaceholder: 'Tìm theo tên, quốc gia, thị trường...',
    emptyMessage: 'Chưa có khách hàng xuất khẩu nào',
    addLabel: 'Thêm khách hàng xuất khẩu',
    pageSize: 10,
    columns: [
      { key: 'name', label: 'Tên khách hàng' },
      { key: 'country', label: 'Quốc gia' },
      { key: 'market', label: 'Thị trường' },
      { key: 'contactName', label: 'Người liên hệ' },
    ],
    formFields: [
      { name: 'name', label: 'Tên khách hàng', type: 'text', required: true },
      { name: 'country', label: 'Quốc gia', type: 'text' },
      { name: 'market', label: 'Thị trường', type: 'text' },
      { name: 'contactName', label: 'Người liên hệ', type: 'text' },
    ],
    deleteConfirm: (c) => ({
      title: 'Xóa khách hàng xuất khẩu',
      message: `Xóa khách hàng xuất khẩu "${c.name}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, c) => {
      if (action === 'create') logAction('export-customer', String(c.id), 'masterdata.created', c.name)
      else if (action === 'update') logAction('export-customer', String(c.id), 'masterdata.updated', c.name)
      else logAction('export-customer', String(c.id), 'masterdata.deleted', c.name)
    },
    api: {
      list: getMfgExportCustomers,
      create: createMfgExportCustomer,
      update: (id, data) => updateMfgExportCustomer(id, data) as Promise<ExportCustomer | undefined>,
      remove: (id) => deleteMfgExportCustomer(id),
    },
  }

  return <AdminEntityPage config={config} />
}
