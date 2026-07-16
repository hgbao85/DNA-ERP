'use client'
import { Users } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getSalesCustomers, createSalesCustomer, updateSalesCustomer, deleteSalesCustomer } from '../../../../services/api'
import type { SalesCustomer } from '../../../../types/sales'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

export default function SalesCustomersPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<SalesCustomer> = {
    title: 'Khách hàng bán hàng',
    icon: <Users size={18} color="#3949ab" />,
    searchFields: ['name', 'phone', 'email'],
    searchPlaceholder: 'Tìm theo tên, SĐT hoặc email...',
    emptyMessage: 'Chưa có khách hàng nào',
    addLabel: 'Thêm khách hàng',
    pageSize: 10,
    columns: [
      { key: 'name', label: 'Tên khách hàng' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'createdAt', label: 'Ngày tạo', render: (c) => new Date(c.createdAt).toLocaleDateString('vi-VN') },
    ],
    formFields: [
      { name: 'name', label: 'Tên khách hàng', type: 'text', required: true },
      { name: 'phone', label: 'Điện thoại', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'address', label: 'Địa chỉ', type: 'text' },
      { name: 'note', label: 'Ghi chú', type: 'text' },
    ],
    deleteConfirm: (c) => ({
      title: 'Xóa khách hàng',
      message: `Xóa khách hàng "${c.name}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, c) => {
      if (action === 'create') logAction('sales-customer', String(c.id), 'masterdata.created', c.name)
      else if (action === 'update') logAction('sales-customer', String(c.id), 'masterdata.updated', c.name)
      else logAction('sales-customer', String(c.id), 'masterdata.deleted', c.name)
    },
    api: {
      list: getSalesCustomers,
      create: createSalesCustomer,
      update: (id, data) => updateSalesCustomer(Number(id), data),
      remove: (id) => deleteSalesCustomer(Number(id)),
    },
  }

  return <AdminEntityPage config={config} />
}
