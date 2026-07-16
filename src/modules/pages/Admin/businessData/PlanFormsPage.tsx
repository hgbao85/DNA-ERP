'use client'
import { Layers3 } from 'lucide-react'
import { getPlanForms } from '../../../../services/api'
import type { PlanForm, PlanFormStatus } from '../../../../types/plan-form'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

const STATUS_LABEL: Record<PlanFormStatus, string> = {
  DRAFT: 'Nháp',
  WAITING_DETAIL: 'Chờ nhập định mức chi tiết',
  WAITING_PARTS: 'Chờ nhập định mức mảnh',
  APPROVED_DETAIL: 'Đã duyệt chi tiết',
  APPROVED_PARTS: 'Đã duyệt mảnh',
  WAITING_QLSX_APPROVAL: 'Chờ QLSX duyệt',
  WAITING_BOSS_APPROVAL: 'Chờ Giám đốc duyệt',
  APPROVED: 'Đã duyệt — đang sản xuất',
  REJECTED: 'Bị từ chối',
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

export default function PlanFormsPage() {
  const config: AdminReadOnlyListConfig<PlanForm> = {
    title: 'SKU / Định mức',
    icon: <Layers3 size={16} color="#3949ab" />,
    searchFields: ['piCode', 'customerName'],
    searchPlaceholder: 'Tìm theo mã PI hoặc khách hàng...',
    emptyMessage: 'Chưa có SKU nào',
    pageSize: 10,
    columns: [
      { key: 'piCode', label: 'Mã PI' },
      { key: 'mfgProduct', label: 'Sản phẩm', render: (f) => f.mfgProduct ? `${f.mfgProduct.factoryCode} — ${f.mfgProduct.name}` : '—' },
      { key: 'customerName', label: 'Khách hàng', render: (f) => f.customerName ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (f) => STATUS_LABEL[f.status] ?? f.status },
      { key: 'createdAt', label: 'Ngày tạo', render: (f) => fmtDate(f.createdAt) },
    ],
    filters: [
      { key: 'pending', label: 'Đang xử lý', predicate: (f) => !['APPROVED', 'REJECTED'].includes(f.status) },
      { key: 'APPROVED', label: 'Đã duyệt', predicate: (f) => f.status === 'APPROVED' },
      { key: 'REJECTED', label: 'Từ chối', predicate: (f) => f.status === 'REJECTED' },
    ],
    fetch: getPlanForms,
  }

  return <AdminReadOnlyList config={config} />
}
