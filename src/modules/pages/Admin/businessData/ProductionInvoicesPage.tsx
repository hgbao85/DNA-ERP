'use client'
import { Factory } from 'lucide-react'
import { getProductionInvoices } from '../../../../services/api'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

interface ProductionInvoice {
  id: number
  code: string
  deadline?: string
  status: string
  exportOrder?: { poNumber: string }
  createdBy?: { name: string }
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Lên kế hoạch',
  PRODUCING: 'Đang sản xuất',
  DONE: 'Hoàn thành',
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

export default function ProductionInvoicesPage() {
  const config: AdminReadOnlyListConfig<ProductionInvoice> = {
    title: 'Lệnh sản xuất (PI)',
    icon: <Factory size={16} color="#3949ab" />,
    searchFields: ['code'],
    searchPlaceholder: 'Tìm theo mã PI...',
    emptyMessage: 'Chưa có lệnh sản xuất nào',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã PI' },
      { key: 'exportOrder', label: 'Đơn xuất khẩu', render: (p) => p.exportOrder?.poNumber ?? '—' },
      { key: 'deadline', label: 'Deadline', render: (p) => fmtDate(p.deadline) },
      { key: 'status', label: 'Trạng thái', render: (p) => STATUS_LABEL[p.status] ?? p.status },
      { key: 'createdBy', label: 'Người tạo', render: (p) => p.createdBy?.name ?? '—' },
    ],
    filters: [
      { key: 'PLANNING', label: 'Lên kế hoạch', predicate: (p) => p.status === 'PLANNING' },
      { key: 'PRODUCING', label: 'Đang sản xuất', predicate: (p) => p.status === 'PRODUCING' },
      { key: 'DONE', label: 'Hoàn thành', predicate: (p) => p.status === 'DONE' },
    ],
    fetch: () => getProductionInvoices() as Promise<ProductionInvoice[]>,
  }

  return <AdminReadOnlyList config={config} />
}
